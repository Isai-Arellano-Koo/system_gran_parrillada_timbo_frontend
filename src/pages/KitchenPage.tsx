import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { kitchenApi } from "../api/services";
import { ApiError } from "../api/client";
import type { AttentionModality, KitchenTicket, OrderDetail } from "../types";
import {
  attentionLabel,
  kitchenStatusLabel,
  orderCodeLabel,
  tablesLabel,
} from "../types";
import { StatusLegend } from "../components/StatusLegend";
import { useLiveReload } from "../context/LiveContext";
import { kitchenTone, toneClass } from "../helpers/orderStatus";
import { formatDateTime } from "../helpers/datetime";
import { matchesQuery } from "../helpers/search";
import { returnKindLabel } from "../components/OrderStockActions";

const FLOW: KitchenTicket["status"][] = [
  "pendiente",
  "en_preparacion",
  "listo",
  "entregado",
];

type KitchenStatus = KitchenTicket["status"];
type ViewMode = "pedidos" | "platos";
type StatusFilter = "all" | "pendiente" | "en_preparacion" | "listo";
type SortMode = "entrada" | "recientes";

function badgeFor(status?: string) {
  return toneClass(kitchenTone(status));
}

function nextStatus(current?: string) {
  const idx = FLOW.indexOf((current || "pendiente") as KitchenStatus);
  return idx >= 0 && idx < FLOW.length - 1 ? FLOW[idx + 1] : null;
}

function nextLabel(status: KitchenStatus, modality?: string) {
  if (status === "en_preparacion") return "En preparación";
  if (status === "listo") return "Listo";
  if (status === "entregado") return modality === "delivery" ? "Entregado" : "Salió a mesa";
  return kitchenStatusLabel(status, modality);
}

function dishKitchenStatus(detail: OrderDetail) {
  return detail.kitchen_status || "pendiente";
}

function ticketStamp(ticket: KitchenTicket) {
  return ticket.order?.created_at || ticket.created_at || "";
}

function orderPlace(ticket: KitchenTicket) {
  const order = ticket.order;
  if (!order) return `Pedido #${ticket.order_id}`;
  if (order.modality === "mesa" || !order.modality) return tablesLabel(order);
  return `${attentionLabel(order.modality)} · ${
    order.delivery_customer_name || "Sin nombre"
  }`;
}

function dishKey(detail: OrderDetail) {
  return `${detail.dish_id}::${(detail.dish?.presentation || "").trim()}`;
}

function dishName(detail: OrderDetail) {
  return detail.dish?.name || `Plato ${detail.dish_id}`;
}

export function KitchenPage() {
  const { token, user } = useAuth();
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [view, setView] = useState<ViewMode>("pedidos");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [modality, setModality] = useState<"all" | AttentionModality>("all");
  const [sort, setSort] = useState<SortMode>("entrada");
  const [query, setQuery] = useState("");
  const [notesOnly, setNotesOnly] = useState(false);

  const load = async () => {
    if (!token) return;
    const list = await kitchenApi.list(token);
    setTickets(list);
    setOpenId((current) => {
      if (current && list.some((ticket) => ticket.id === current)) return current;
      const first = list.find((ticket) => ticket.status !== "entregado");
      return first?.id ?? null;
    });
  };

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof ApiError ? err.message : "Error al cargar")
    );
  }, [token]);

  useLiveReload(["kitchen", "orders"], () => {
    load().catch(() => undefined);
  });

  const canCook = user?.role === "cocinero" || user?.role === "admin";

  const applyTicket = (ticket: KitchenTicket) => {
    setTickets((prev) => prev.map((item) => (item.id === ticket.id ? ticket : item)));
  };

  const advanceDish = async (detail: OrderDetail) => {
    if (!token) return;
    const next = nextStatus(dishKitchenStatus(detail));
    if (!next) return;
    if (!canCook) return;
    setBusyId(detail.id);
    try {
      applyTicket(await kitchenApi.updateDishStatus(token, detail.id, next));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo actualizar el plato");
    } finally {
      setBusyId(null);
    }
  };

  const visibleTickets = useMemo(() => {
    const open = tickets.filter((ticket) => ticket.status !== "entregado");
    const filtered = open.filter((ticket) => {
      const details = ticket.order?.details || [];
      if (modality !== "all" && (ticket.order?.modality || "mesa") !== modality) {
        return false;
      }
      if (statusFilter !== "all") {
        const hit =
          ticket.status === statusFilter ||
          details.some((detail) => dishKitchenStatus(detail) === statusFilter);
        if (!hit) return false;
      }
      if (notesOnly && !details.some((detail) => Boolean(detail.observation?.trim()))) {
        return false;
      }
      return matchesQuery(
        query,
        ticket.order ? orderCodeLabel(ticket.order) : ticket.order_id,
        orderPlace(ticket),
        ticket.order?.waiter?.name,
        attentionLabel(ticket.order?.modality),
        kitchenStatusLabel(ticket.status, ticket.order?.modality),
        ...details.flatMap((detail) => [
          dishName(detail),
          detail.dish?.presentation,
          detail.observation,
        ])
      );
    });
    const dir = sort === "entrada" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const left = new Date(ticketStamp(a)).getTime() || 0;
      const right = new Date(ticketStamp(b)).getTime() || 0;
      return (left - right) * dir;
    });
  }, [tickets, modality, statusFilter, notesOnly, query, sort]);

  const dishGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        name: string;
        presentation: string;
        total: number;
        earliest: number;
        lines: { ticket: KitchenTicket; detail: OrderDetail }[];
      }
    >();
    for (const ticket of visibleTickets) {
      for (const detail of ticket.order?.details || []) {
        if (detail.return_kind) continue;
        const status = dishKitchenStatus(detail);
        if (status === "entregado") continue;
        if (statusFilter !== "all" && status !== statusFilter) continue;
        if (notesOnly && !detail.observation?.trim()) continue;
        if (
          query.trim() &&
          !matchesQuery(
            query,
            dishName(detail),
            detail.dish?.presentation,
            detail.observation,
            ticket.order ? orderCodeLabel(ticket.order) : ticket.order_id,
            orderPlace(ticket),
            ticket.order?.waiter?.name
          )
        ) {
          continue;
        }
        const key = dishKey(detail);
        const current = groups.get(key);
        const stamp = new Date(ticketStamp(ticket)).getTime() || 0;
        if (current) {
          current.total += Number(detail.quantity);
          current.lines.push({ ticket, detail });
          current.earliest = Math.min(current.earliest, stamp);
        } else {
          groups.set(key, {
            key,
            name: dishName(detail),
            presentation: detail.dish?.presentation || "",
            total: Number(detail.quantity),
            earliest: stamp,
            lines: [{ ticket, detail }],
          });
        }
      }
    }
    const list = [...groups.values()];
    const dir = sort === "entrada" ? 1 : -1;
    list.sort((a, b) => (a.earliest - b.earliest) * dir);
    for (const group of list) {
      group.lines.sort(
        (a, b) =>
          ((new Date(ticketStamp(a.ticket)).getTime() || 0) -
            (new Date(ticketStamp(b.ticket)).getTime() || 0)) *
          dir
      );
    }
    return list;
  }, [visibleTickets, statusFilter, notesOnly, query, sort]);

  const renderDishLine = (ticket: KitchenTicket, detail: OrderDetail) => {
    const status = dishKitchenStatus(detail);
    const next = nextStatus(status);
    const canAdvance = Boolean(next) && canCook && !detail.return_kind;
    return (
      <article
        key={detail.id}
        className={`kitchen-dish st-band ${toneClass(kitchenTone(status))}${
          status === "entregado" ? " kitchen-dish-entregado" : ""
        }`}
      >
        <div>
          <strong>
            {detail.quantity}× {dishName(detail)}
          </strong>
          {detail.dish?.presentation ? (
            <p className="muted">{detail.dish.presentation}</p>
          ) : null}
          {view === "platos" ? (
            <p className="muted">
              {ticket.order ? orderCodeLabel(ticket.order) : `Pedido #${ticket.order_id}`}{" "}
              · {orderPlace(ticket)} · {ticket.order?.waiter?.name || "Sin mesero"} ·{" "}
              {formatDateTime(ticketStamp(ticket))}
            </p>
          ) : null}
          {detail.observation ? (
            <p className="kitchen-note">Nota: {detail.observation}</p>
          ) : null}
          {detail.return_kind ? (
            <p className="muted">{returnKindLabel(detail.return_kind)}</p>
          ) : null}
        </div>
        <div className="kitchen-dish-actions">
          <span className={`badge ${badgeFor(status)}`}>
            {kitchenStatusLabel(status, ticket.order?.modality)}
          </span>
          {canAdvance && next ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busyId === detail.id}
              onClick={() => advanceDish(detail)}
            >
              {nextLabel(next, ticket.order?.modality)}
            </button>
          ) : null}
        </div>
      </article>
    );
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Cocina</h1>
          <p>
            Las comandas salen en orden de llegada. También puedes agrupar por
            plato para cocinar juntos los que coinciden.
          </p>
          <StatusLegend variant="kitchen" />
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <section className="panel kitchen-filters">
        <div className="page-tabs" role="tablist" aria-label="Vista de cocina">
          <button
            type="button"
            role="tab"
            aria-selected={view === "pedidos"}
            className={`page-tab${view === "pedidos" ? " active" : ""}`}
            onClick={() => setView("pedidos")}
          >
            Pedidos
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "platos"}
            className={`page-tab${view === "platos" ? " active" : ""}`}
            onClick={() => setView("platos")}
          >
            Por platos
          </button>
        </div>
        <div className="filter-grid">
          <label>
            Buscar
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pedido, mesa, plato, mesero…"
            />
          </label>
          <label>
            Estado
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="all">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="en_preparacion">En preparación</option>
              <option value="listo">Listo</option>
            </select>
          </label>
          <label>
            Modalidad
            <select
              value={modality}
              onChange={(e) =>
                setModality(e.target.value as "all" | AttentionModality)
              }
            >
              <option value="all">Todas</option>
              <option value="mesa">Mesa</option>
              <option value="delivery">Delivery</option>
              <option value="para_llevar">Para llevar</option>
            </select>
          </label>
          <label>
            Orden
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
            >
              <option value="entrada">Orden de entrada</option>
              <option value="recientes">Más recientes</option>
            </select>
          </label>
        </div>
        <label className="switch kitchen-notes-filter">
          <input
            type="checkbox"
            checked={notesOnly}
            onChange={(e) => setNotesOnly(e.target.checked)}
          />
          <span className="switch-ui" aria-hidden="true" />
          Solo platos con nota
        </label>
      </section>

      {view === "pedidos" ? (
        <>
          <div className="kitchen-board">
            {visibleTickets.map((ticket) => {
              const details = ticket.order?.details || [];
              const open = openId === ticket.id;
              const ready = details.filter(
                (detail) =>
                  dishKitchenStatus(detail) === "listo" ||
                  dishKitchenStatus(detail) === "entregado"
              ).length;
              return (
                <article
                  className={`ticket kitchen-card st-band ${toneClass(
                    kitchenTone(ticket.status)
                  )}${open ? " open" : ""}`}
                  key={ticket.id}
                >
                  <button
                    type="button"
                    className="kitchen-card-head"
                    onClick={() => setOpenId(open ? null : ticket.id)}
                  >
                    <div>
                      <strong>
                        {ticket.order
                          ? orderCodeLabel(ticket.order)
                          : `Pedido #${ticket.order_id}`}
                      </strong>
                      <div className="muted">
                        {orderPlace(ticket)} · {ready}/{details.length} listos
                      </div>
                      <div className="muted">
                        {ticket.order?.waiter?.name || "Sin mesero"} ·{" "}
                        {formatDateTime(ticketStamp(ticket))}
                      </div>
                    </div>
                    <div className="actions">
                      <span className="badge badge-edit">
                        {attentionLabel(ticket.order?.modality)}
                      </span>
                      <span className={`badge ${badgeFor(ticket.status)}`}>
                        {kitchenStatusLabel(ticket.status, ticket.order?.modality)}
                      </span>
                    </div>
                  </button>

                  {open ? (
                    <div className="kitchen-dishes">
                      {!details.length ? (
                        <p className="muted">Esta comanda no tiene platos enviados.</p>
                      ) : (
                        details.map((detail) => renderDishLine(ticket, detail))
                      )}
                    </div>
                  ) : (
                    <ul>
                      {details.map((detail) => (
                        <li key={detail.id}>
                          {detail.quantity}× {dishName(detail)} ·{" "}
                          {kitchenStatusLabel(
                            dishKitchenStatus(detail),
                            ticket.order?.modality
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              );
            })}
          </div>
          {!visibleTickets.length ? (
            <div className="panel empty">No hay comandas con esos filtros</div>
          ) : null}
        </>
      ) : (
        <>
          <div className="kitchen-board">
            {dishGroups.map((group) => (
              <article className="ticket kitchen-card kitchen-dish-group" key={group.key}>
                <header>
                  <div>
                    <strong>
                      {group.total}× {group.name}
                    </strong>
                    {group.presentation ? (
                      <div className="muted">{group.presentation}</div>
                    ) : null}
                    <div className="muted">
                      {group.lines.length}{" "}
                      {group.lines.length === 1 ? "pedido" : "pedidos"}
                    </div>
                  </div>
                </header>
                <div className="kitchen-dishes">
                  {group.lines.map(({ ticket, detail }) =>
                    renderDishLine(ticket, detail)
                  )}
                </div>
              </article>
            ))}
          </div>
          {!dishGroups.length ? (
            <div className="panel empty">No hay platos con esos filtros</div>
          ) : null}
        </>
      )}
    </div>
  );
}
