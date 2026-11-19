import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { kitchenApi } from "../api/services";
import { ApiError } from "../api/client";
import type { KitchenTicket, OrderDetail } from "../types";
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
import { returnKindLabel } from "../components/OrderStockActions";

const FLOW: KitchenTicket["status"][] = [
  "pendiente",
  "en_preparacion",
  "listo",
  "entregado",
];

function badgeFor(status?: string) {
  return toneClass(kitchenTone(status));
}

function nextStatus(current?: string) {
  const idx = FLOW.indexOf((current || "pendiente") as KitchenTicket["status"]);
  return idx >= 0 && idx < FLOW.length - 1 ? FLOW[idx + 1] : null;
}

function nextLabel(status: KitchenTicket["status"], modality?: string) {
  if (status === "en_preparacion") return "En preparación";
  if (status === "listo") return "Listo";
  if (status === "entregado") return modality === "delivery" ? "Entregado" : "Salió a mesa";
  return kitchenStatusLabel(status, modality);
}

function dishKitchenStatus(detail: OrderDetail) {
  return detail.kitchen_status || "pendiente";
}

export function KitchenPage() {
  const { token, user } = useAuth();
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

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

  const openTickets = tickets.filter((ticket) => ticket.status !== "entregado");

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Cocina</h1>
          <p>
            Abre la comanda y marca cada plato cuando va saliendo. No hace falta
            que salgan todos juntos.
          </p>
          <StatusLegend variant="kitchen" />
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="kitchen-board">
        {openTickets.map((ticket) => {
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
                    {ticket.order?.modality === "mesa" || !ticket.order?.modality
                      ? tablesLabel(ticket.order)
                      : `${attentionLabel(ticket.order.modality)} · ${
                          ticket.order.delivery_customer_name || "Sin nombre"
                        }`}{" "}
                    · {ready}/{details.length} listos
                  </div>
                  <div className="muted">
                    {ticket.order?.waiter?.name || "Sin mesero"} ·{" "}
                    {formatDateTime(
                      ticket.order?.created_at || ticket.created_at
                    )}
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
                    details.map((detail) => {
                      const status = dishKitchenStatus(detail);
                      const next = nextStatus(status);
                      const canAdvance =
                        Boolean(next) && canCook && !detail.return_kind;
                      return (
                        <article
                          key={detail.id}
                          className={`kitchen-dish st-band ${toneClass(
                            kitchenTone(status)
                          )}${status === "entregado" ? " kitchen-dish-entregado" : ""}`}
                        >
                          <div>
                            <strong>
                              {detail.quantity}×{" "}
                              {detail.dish?.name || `Plato ${detail.dish_id}`}
                            </strong>
                            {detail.dish?.presentation ? (
                              <p className="muted">{detail.dish.presentation}</p>
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
                    })
                  )}
                </div>
              ) : (
                <ul>
                  {details.map((detail) => (
                    <li key={detail.id}>
                      {detail.quantity}× {detail.dish?.name || detail.dish_id} ·{" "}
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

      {!openTickets.length ? (
        <div className="panel empty">No hay comandas pendientes</div>
      ) : null}
    </div>
  );
}
