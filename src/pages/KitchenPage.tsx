import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { kitchenApi } from "../api/services";
import { ApiError } from "../api/client";
import type { KitchenTicket } from "../types";

const FLOW: KitchenTicket["status"][] = [
  "pendiente",
  "en_preparacion",
  "listo",
  "entregado",
];

function badgeFor(status: KitchenTicket["status"]) {
  if (status === "pendiente") return "badge-warn";
  if (status === "en_preparacion") return "badge-edit";
  if (status === "listo") return "badge-ok";
  return "badge-ok";
}

export function KitchenPage() {
  const { token, user } = useAuth();
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [error, setError] = useState("");

  const load = async () => {
    if (!token) return;
    setTickets(await kitchenApi.list(token));
  };

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof ApiError ? err.message : "Error al cargar")
    );
    const id = window.setInterval(() => {
      load().catch(() => undefined);
    }, 8000);
    return () => window.clearInterval(id);
  }, [token]);

  const nextStatus = (current: KitchenTicket["status"]) => {
    const idx = FLOW.indexOf(current);
    return idx >= 0 && idx < FLOW.length - 1 ? FLOW[idx + 1] : null;
  };

  const advance = async (ticket: KitchenTicket) => {
    if (!token) return;
    const next = nextStatus(ticket.status);
    if (!next) return;
    try {
      await kitchenApi.updateStatus(token, ticket.id, next);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo actualizar");
    }
  };

  const canUpdate = user?.role === "cocinero" || user?.role === "admin";

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Cocina</h1>
          <p>HU10 / HU11 — Comandas confirmadas y avance de preparación.</p>
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="kitchen-board">
        {tickets
          .filter((t) => t.status !== "entregado")
          .map((ticket) => (
            <article className="ticket" key={ticket.id}>
              <header>
                <div>
                  <strong>{ticket.order?.code || `Pedido #${ticket.order_id}`}</strong>
                  <div className="muted">
                    Mesa {ticket.order?.table?.number ?? "—"} ·{" "}
                    {ticket.order?.confirmed_at
                      ? new Date(ticket.order.confirmed_at).toLocaleTimeString()
                      : new Date(ticket.status_changed_at || Date.now()).toLocaleTimeString()}
                  </div>
                </div>
                <span className={`badge ${badgeFor(ticket.status)}`}>
                  {ticket.status.replace("_", " ")}
                </span>
              </header>

              <ul>
                {(ticket.order?.details || []).map((d) => (
                  <li key={d.id}>
                    {d.quantity}× {d.dish?.name || d.dish_id}
                    {d.observation ? ` — ${d.observation}` : ""}
                  </li>
                ))}
              </ul>

              {canUpdate && nextStatus(ticket.status) ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => advance(ticket)}
                >
                  Marcar: {nextStatus(ticket.status)?.replace("_", " ")}
                </button>
              ) : null}
            </article>
          ))}
      </div>

      {tickets.filter((t) => t.status !== "entregado").length === 0 ? (
        <div className="panel empty">No hay comandas pendientes</div>
      ) : null}
    </div>
  );
}
