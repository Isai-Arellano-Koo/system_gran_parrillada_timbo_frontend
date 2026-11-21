import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLiveReload } from "../context/LiveContext";
import { ordersApi } from "../api/services";
import { ApiError } from "../api/client";
import type {
  AttentionModality,
  Order,
  OrderHistoryStatusFilter,
  OrdersHistorySummary,
} from "../types";
import {
  attentionLabel,
  dishLabel,
  kitchenStatusLabel,
  orderCodeLabel,
  tablesLabel,
} from "../types";
import {
  formatDateTime,
  limaMonthStart,
  limaYmd,
  shiftLimaYmd,
} from "../helpers/datetime";
import { matchesQuery } from "../helpers/search";
import { usePagedRows } from "../helpers/pagination";
import { TablePager } from "../components/TablePager";
import { roleLabel } from "../constants/roles";
import { returnKindLabel } from "../components/OrderStockActions";
import {
  isUnpaid,
  kitchenTone,
  orderStatusLabel,
  orderTone,
  toneClass,
} from "../helpers/orderStatus";

type ModalityFilter = "all" | AttentionModality;

function money(value: number | string) {
  return `S/ ${Number(value).toFixed(2)}`;
}

function attendedBy(order: Order) {
  const name = order.waiter?.name?.trim();
  if (!name) return "—";
  const role = order.waiter?.role ? roleLabel(order.waiter.role) : "";
  return role ? `${name} · ${role}` : name;
}

function destination(order: Order) {
  if (order.modality === "delivery" || order.modality === "para_llevar") {
    return order.delivery_customer_name?.trim() || attentionLabel(order.modality);
  }
  return tablesLabel(order);
}

const emptySummary: OrdersHistorySummary = {
  count: 0,
  sales_total: 0,
  pending_total: 0,
  cancelled_total: 0,
  by_status: {
    en_edicion: { count: 0, total: 0 },
    confirmado: { count: 0, total: 0 },
    cerrado: { count: 0, total: 0 },
    cancelado: { count: 0, total: 0 },
  },
};

export function OrdersHistoryPage() {
  const { token } = useAuth();
  const today = limaYmd();
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<OrdersHistorySummary>(emptySummary);
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [status, setStatus] = useState<OrderHistoryStatusFilter>("all");
  const [modality, setModality] = useState<ModalityFilter>("all");
  const [selected, setSelected] = useState<Order | null>(null);
  const [error, setError] = useState("");

  const selectedId = useRef<number | undefined>(undefined);
  selectedId.current = selected?.id;
  const filtersRef = useRef({ from, to, status, modality });
  filtersRef.current = { from, to, status, modality };

  const load = async (keepId?: number) => {
    if (!token) return;
    const filters = filtersRef.current;
    const data = await ordersApi.history(token, {
      from: filters.from,
      to: filters.to,
      status: filters.status,
      modality: filters.modality === "all" ? undefined : filters.modality,
    });
    setOrders(data.orders);
    setSummary(data.summary);
    const id = keepId ?? selectedId.current;
    if (!id) {
      setSelected(null);
      return;
    }
    if (!data.orders.some((order) => order.id === id)) {
      setSelected(null);
      return;
    }
    const detail = await ordersApi.get(token, id).catch(() => null);
    setSelected(detail || data.orders.find((order) => order.id === id) || null);
  };

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof ApiError ? err.message : "Error al cargar")
    );
  }, [token, from, to, status, modality]);

  useLiveReload(["orders", "kitchen", "tables"], () => {
    load(selectedId.current).catch(() => undefined);
  });

  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected]);

  const visible = useMemo(
    () =>
      orders.filter((order) =>
        matchesQuery(
          query,
          orderCodeLabel(order),
          attentionLabel(order.modality),
          destination(order),
          attendedBy(order),
          order.delivery_phone,
          order.delivery_address,
          order.status
        )
      ),
    [orders, query]
  );
  const paged = usePagedRows(visible, `${query}|${modality}|${from}|${to}|${status}`);

  const openDetail = async (order: Order) => {
    if (!token) return;
    setError("");
    setSelected(order);
    try {
      const detail = await ordersApi.get(token, order.id);
      setSelected(detail);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "No se pudo abrir el detalle"
      );
    }
  };

  const emptyMessage =
    query.trim() || status !== "all" || modality !== "all" || from !== to
      ? "No se encontraron pedidos en el periodo"
      : "Aún no hay pedidos en esta fecha";

  return (
    <div>
      <div className="page-head">
        <div>
          <p className="crumb">Administración › Ventas</p>
          <h1>Historial de ventas</h1>
          <p>
            Consulta pedidos por día o rango, distingue pendientes de
            completados y revisa el importe del periodo.
          </p>
        </div>
      </div>
      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="ops-kpis ops-kpis-4" style={{ marginBottom: "1rem" }}>
        <article className="ops-kpi">
          <div className="ops-kpi-top">
            <span>Pedidos</span>
          </div>
          <strong>{summary.count}</strong>
          <p>En el periodo seleccionado</p>
        </article>
        <article className="ops-kpi">
          <div className="ops-kpi-top">
            <span>Ventas</span>
          </div>
          <strong>{money(summary.sales_total)}</strong>
          <p>Confirmados y cerrados</p>
        </article>
        <article className="ops-kpi">
          <div className="ops-kpi-top">
            <span>Pendientes</span>
          </div>
          <strong>{money(summary.pending_total)}</strong>
          <p>
            {summary.by_status.en_edicion.count} en edición ·{" "}
            {summary.by_status.confirmado.count} confirmados
          </p>
        </article>
        <article className="ops-kpi">
          <div className="ops-kpi-top">
            <span>Cancelados</span>
          </div>
          <strong>{money(summary.cancelled_total)}</strong>
          <p>{summary.by_status.cancelado.count} pedidos</p>
        </article>
      </div>

      <section className="panel">
        <div className="list-head">
          <div>
            <h2>Pedidos</h2>
            <p>
              {visible.length}{" "}
              {visible.length === 1 ? "pedido" : "pedidos"} · ventas{" "}
              {money(summary.sales_total)}
            </p>
          </div>
        </div>
        <div className="page-tabs" role="tablist" aria-label="Modalidad">
          {(
            [
              ["all", "Todas"],
              ["mesa", "Mesa"],
              ["delivery", "Delivery"],
              ["para_llevar", "Para llevar"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={modality === value}
              className={`page-tab${modality === value ? " active" : ""}`}
              onClick={() => {
                setModality(value);
                setSelected(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="filter-dates">
          <label>
            Desde
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value || today)}
            />
          </label>
          <label>
            Hasta
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value || today)}
            />
          </label>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              const now = limaYmd();
              setFrom(now);
              setTo(now);
            }}
          >
            Hoy
          </button>
        </div>
        <div className="filter-grid">
          <label>
            Estado
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as OrderHistoryStatusFilter)
              }
            >
              <option value="all">Todos</option>
              <option value="pendientes">Pendientes</option>
              <option value="completados">Completados</option>
              <option value="en_edicion">En edición</option>
              <option value="confirmado">Confirmado</option>
              <option value="cerrado">Cerrado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </label>
          <label>
            Buscar
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Orden, mesa, cliente, quien atendió…"
            />
          </label>
        </div>
        <div className="filter-bar" style={{ marginBottom: "0.85rem" }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              const now = limaYmd();
              setFrom(shiftLimaYmd(now, -6));
              setTo(now);
            }}
          >
            7 días
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              const now = limaYmd();
              setFrom(limaMonthStart(now));
              setTo(now);
            }}
          >
            Este mes
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Confirmación</th>
                <th>Orden</th>
                <th>Modalidad</th>
                <th>Destino</th>
                <th>Atendió</th>
                <th>Estado</th>
                <th>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paged.rows.map((order) => (
                <tr
                  key={order.id}
                  className={`st-band ${toneClass(orderTone(order), isUnpaid(order))}${
                    selected?.id === order.id ? " is-selected" : ""
                  }`}
                >
                  <td>{formatDateTime(order.confirmed_at || order.created_at)}</td>
                  <td>
                    <strong>{orderCodeLabel(order)}</strong>
                  </td>
                  <td>{attentionLabel(order.modality)}</td>
                  <td>{destination(order)}</td>
                  <td>{attendedBy(order)}</td>
                  <td>
                    <span
                      className={`badge ${toneClass(
                        orderTone(order),
                        isUnpaid(order)
                      )}`}
                    >
                      {orderStatusLabel(order)}
                    </span>
                  </td>
                  <td>{money(order.total)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => void openDetail(order)}
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visible.length ? <div className="empty">{emptyMessage}</div> : null}
        </div>
        <TablePager
          total={visible.length}
          page={paged.current}
          onPage={paged.setPage}
        />
      </section>

      {selected ? (
        <div
          className="dialog-backdrop"
          role="presentation"
          onClick={() => setSelected(null)}
        >
          <div
            className="dialog dialog-wide panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-history-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="list-head">
              <div>
                <h2 id="order-history-detail-title">Detalle del pedido</h2>
                <p>{orderCodeLabel(selected)}</p>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setSelected(null)}
              >
                Cerrar
              </button>
            </div>
            <dl className="facts">
              <dt>Modalidad</dt>
              <dd>{attentionLabel(selected.modality)}</dd>
              {selected.modality === "mesa" || !selected.modality ? (
                <>
                  <dt>Mesa</dt>
                  <dd>{tablesLabel(selected)}</dd>
                </>
              ) : (
                <>
                  <dt>Cliente</dt>
                  <dd>{selected.delivery_customer_name || "—"}</dd>
                  <dt>Teléfono</dt>
                  <dd>{selected.delivery_phone || "—"}</dd>
                  {selected.modality === "delivery" ? (
                    <>
                      <dt>Dirección</dt>
                      <dd>{selected.delivery_address || "—"}</dd>
                    </>
                  ) : null}
                </>
              )}
              <dt>Atendió</dt>
              <dd>{attendedBy(selected)}</dd>
              <dt>Estado</dt>
              <dd>{orderStatusLabel(selected)}</dd>
              {selected.kitchen_ticket ? (
                <>
                  <dt>Cocina</dt>
                  <dd>
                    {kitchenStatusLabel(
                      selected.kitchen_ticket.status,
                      selected.modality
                    )}
                  </dd>
                </>
              ) : null}
              <dt>Pago</dt>
              <dd>
                {selected.status === "en_edicion"
                  ? "Pendiente de confirmar"
                  : isUnpaid(selected)
                    ? "Sin pagar"
                    : "Pagado"}
              </dd>
              <dt>Total</dt>
              <dd>{money(selected.total)}</dd>
              <dt>Creado</dt>
              <dd>{formatDateTime(selected.created_at)}</dd>
              <dt>Confirmación</dt>
              <dd>{formatDateTime(selected.confirmed_at)}</dd>
              {selected.status === "cancelado" ? (
                <>
                  <dt>Canceló</dt>
                  <dd>
                    {selected.cancellation?.cancelled_by_user?.name ||
                      selected.cancelled_by_user?.name ||
                      "—"}
                    {selected.cancellation?.cancelled_by_user?.role
                      ? ` · ${roleLabel(selected.cancellation.cancelled_by_user.role)}`
                      : ""}
                  </dd>
                  <dt>Antes</dt>
                  <dd>
                    {selected.cancellation?.previous_status || "—"}
                    {selected.cancellation?.previous_kitchen_status
                      ? ` · cocina ${selected.cancellation.previous_kitchen_status}`
                      : ""}
                  </dd>
                  <dt>Motivo</dt>
                  <dd>{selected.cancellation?.reason || selected.cancel_reason || "—"}</dd>
                  <dt>Stock</dt>
                  <dd>
                    {selected.cancellation?.stock_action === "merma"
                      ? "Registrado como merma (pendiente de revisión)"
                      : "Sin movimiento de stock"}
                  </dd>
                  <dt>Cancelado</dt>
                  <dd>
                    {formatDateTime(
                      selected.cancellation?.created_at || selected.cancelled_at
                    )}
                  </dd>
                </>
              ) : null}
            </dl>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Plato</th>
                    <th>Cant.</th>
                    <th>Precio</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(selected.details || []).map((detail) => (
                    <tr
                      key={detail.id}
                      className={
                        detail.sent_to_kitchen
                          ? `st-band ${toneClass(kitchenTone(detail.kitchen_status))}`
                          : undefined
                      }
                    >
                      <td>
                        <strong>
                          {detail.dish
                            ? dishLabel(detail.dish)
                            : `Plato ${detail.dish_id}`}
                        </strong>
                        {detail.observation ? (
                          <div className="hint">{detail.observation}</div>
                        ) : null}
                        {detail.return_kind ? (
                          <div className="hint">
                            {returnKindLabel(detail.return_kind)}
                            {detail.return_note ? ` · ${detail.return_note}` : ""}
                          </div>
                        ) : null}
                      </td>
                      <td>{detail.quantity}</td>
                      <td>{money(detail.unit_price)}</td>
                      <td>
                        {money(
                          detail.charged === false
                            ? 0
                            : Number(detail.unit_price) * Number(detail.quantity)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!(selected.details || []).length ? (
                <div className="empty">Este pedido no tiene platos.</div>
              ) : null}
            </div>
            {(selected.inventory_movements || []).some(
              (item) => item.type === "merma" || item.type === "devolucion"
            ) ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Inventario</th>
                      <th>Cant.</th>
                      <th>Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selected.inventory_movements || [])
                      .filter(
                        (item) =>
                          item.type === "merma" || item.type === "devolucion"
                      )
                      .map((item) => (
                        <tr key={item.id}>
                          <td>
                            {item.type === "merma" ? "Merma" : "Devolución"}
                            {item.ingredient?.name
                              ? ` · ${item.ingredient.name}`
                              : ""}
                          </td>
                          <td>
                            {Number(item.quantity)} {item.ingredient?.unit || ""}
                          </td>
                          <td>{item.reason || "—"}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
