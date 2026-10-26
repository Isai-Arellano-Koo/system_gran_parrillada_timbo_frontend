import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { inventoryApi, kitchenApi, ordersApi } from "../api/services";
import type {
  InventoryMovement,
  KitchenTicket,
  Order,
  StockAlert,
} from "../types";
import { formatTime } from "../helpers/datetime";

function formatStock(value: number | string, unit: string) {
  const amount = Number(value);
  if (unit === "g") {
    if (amount >= 1000) return `${trimNum(amount / 1000)} kg`;
    return `${trimNum(amount)} g`;
  }
  if (unit === "ml") {
    if (amount >= 1000) return `${trimNum(amount / 1000)} L`;
    return `${trimNum(amount)} ml`;
  }
  if (unit === "lt") return `${trimNum(amount)} L`;
  if (unit === "unidad") return `${trimNum(amount)} u.`;
  return `${trimNum(amount)} ${unit}`;
}

function trimNum(value: number) {
  return Number(value.toFixed(2)).toString();
}

function minutesAgo(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
}

function ageLabel(value?: string | null) {
  const minutes = minutesAgo(value);
  if (minutes === null) return "";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function isTodayLima(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const lima = date.toLocaleDateString("en-CA", { timeZone: "America/Lima" });
  const now = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Lima",
  });
  return lima === now;
}

function movementLabel(type: string) {
  if (type === "entrada") return "Entrada";
  if (type === "salida_venta") return "Salida";
  if (type === "devolucion") return "Devolución";
  if (type === "ajuste") return "Ajuste";
  if (type === "merma") return "Merma";
  return type;
}

function movementTone(type: string) {
  if (type === "entrada" || type === "devolucion") return "in";
  if (type === "ajuste") return "adj";
  return "out";
}

function movementSigned(type: string, quantity: number | string) {
  const amount = Math.abs(Number(quantity));
  if (type === "entrada" || type === "devolucion") return `+${amount}`;
  if (type === "ajuste") return `${amount}`;
  return `−${amount}`;
}

function KpiIcon({ kind }: { kind: "orders" | "kitchen" | "alerts" }) {
  if (kind === "orders") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 4h8l3 3v13H7z" />
        <path d="M15 4v3h3M9 12h6M9 16h5" />
      </svg>
    );
  }
  if (kind === "kitchen") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 14c0-3 2-5 4-8 2 3 4 5 4 8a4 4 0 0 1-8 0z" />
        <path d="M9 19h6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4 3 20h18L12 4z" />
      <path d="M12 10v5M12 17.5v.5" />
    </svg>
  );
}

export function HomePage() {
  const { token, user } = useAuth();
  const role = user?.role;
  const canOrders = role === "admin" || role === "mesero";
  const canKitchen = role === "admin" || role === "mesero" || role === "cocinero";
  const canInventory = role === "admin";
  const canUsers = role === "admin";
  const canCatalog = role === "admin" || role === "mesero";

  const [orders, setOrders] = useState<Order[]>([]);
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      try {
        const tasks: Promise<void>[] = [];
        if (canOrders || canKitchen) {
          tasks.push(
            ordersApi.list(token).then((list) => setOrders(list)).catch(() => {
              setOrders([]);
            })
          );
        }
        if (canKitchen) {
          tasks.push(
            kitchenApi.list(token).then((list) => setTickets(list)).catch(() => {
              setTickets([]);
            })
          );
        }
        if (canInventory) {
          tasks.push(
            Promise.all([
              inventoryApi.listAlerts(token),
              inventoryApi.listMovements(token),
            ]).then(([alertList, movementList]) => {
              setAlerts(alertList);
              setMovements(movementList);
            })
          );
        }
        await Promise.all(tasks);
      } catch {
        /* ignore summary errors */
      }
    };
    load();
  }, [token, canOrders, canKitchen, canInventory]);

  const activeOrders = useMemo(
    () => orders.filter((order) => order.status === "en_edicion" || order.status === "confirmado"),
    [orders]
  );
  const kitchenOpen = useMemo(
    () =>
      tickets.filter(
        (ticket) => ticket.status === "pendiente" || ticket.status === "en_preparacion"
      ),
    [tickets]
  );
  const kitchenPending = kitchenOpen.filter((ticket) => ticket.status === "pendiente").length;
  const oldestActive = useMemo(() => {
    const times = activeOrders
      .map((order) => order.created_at)
      .filter(Boolean)
      .sort();
    return times[0] || null;
  }, [activeOrders]);
  const kitchenAvg = useMemo(() => {
    const mins = kitchenOpen
      .map((ticket) => minutesAgo(ticket.created_at || ticket.status_changed_at))
      .filter((value): value is number => value !== null);
    if (!mins.length) return "";
    return `${Math.round(mins.reduce((sum, n) => sum + n, 0) / mins.length)} min`;
  }, [kitchenOpen]);
  const criticalAlerts = alerts.filter((item) => Number(item.stock_current) <= 0);
  const lowAlerts = alerts.filter((item) => Number(item.stock_current) > 0);
  const recentMovements = movements.slice(0, 8);
  const movementsToday = recentMovements.some((item) => isTodayLima(item.created_at));

  return (
    <div className="ops-page">
      <p className="ops-crumb">Panel / Panel operativo</p>
      <div className="page-head">
        <div>
          <h1>Panel operativo</h1>
          <p>Resumen de salón, cocina e inventario.</p>
        </div>
      </div>

      <div className="ops-kpis">
        <article className="ops-kpi">
          <div className="ops-kpi-top">
            <span>Pedidos activos</span>
            <span className="ops-kpi-ico accent">
              <KpiIcon kind="orders" />
            </span>
          </div>
          <strong>{activeOrders.length}</strong>
          <p>en curso</p>
          <small>
            {oldestActive
              ? `Más antiguo hace ${ageLabel(oldestActive)}`
              : "Sin pedidos abiertos"}
          </small>
        </article>
        <article className="ops-kpi">
          <div className="ops-kpi-top">
            <span>Comandas en cocina</span>
            <span className="ops-kpi-ico warn">
              <KpiIcon kind="kitchen" />
            </span>
          </div>
          <strong>{kitchenOpen.length}</strong>
          <p>pendientes</p>
          <small>
            {kitchenOpen.length
              ? `${kitchenPending} en espera${kitchenAvg ? ` · Tiempo prom. ${kitchenAvg}` : ""}`
              : "Cocina al día"}
          </small>
        </article>
        <article className="ops-kpi">
          <div className="ops-kpi-top">
            <span>Alertas de stock</span>
            <span className="ops-kpi-ico danger">
              <KpiIcon kind="alerts" />
            </span>
          </div>
          <strong>{canInventory ? alerts.length : "—"}</strong>
          <p>ingredientes</p>
          <small>
            {!canInventory
              ? "Solo administración ve el inventario"
              : alerts.length
                ? `${criticalAlerts.length} críticos · ${lowAlerts.length} bajos`
                : "Sin alertas"}
          </small>
        </article>
      </div>

      <section>
        <p className="ops-label">Accesos rápidos</p>
        <div className="ops-quick">
          {canOrders ? (
            <Link className="btn btn-primary" to="/orders">
              Abrir pedido
            </Link>
          ) : null}
          {canKitchen ? (
            <Link className="btn btn-ghost" to="/kitchen">
              Ver cocina
            </Link>
          ) : null}
          {canCatalog ? (
            <Link className="btn btn-ghost" to="/dishes">
              Catálogo
            </Link>
          ) : null}
          {canInventory ? (
            <Link className="btn btn-ghost" to="/inventory">
              Inventario
            </Link>
          ) : null}
          {canUsers ? (
            <Link className="btn btn-ghost" to="/users">
              Usuarios
            </Link>
          ) : null}
        </div>
      </section>

      {canInventory ? (
        <div className="ops-split">
          <section className="panel ops-panel">
            <div className="list-head">
              <h2>Alertas de inventario</h2>
              <span className={`badge ${alerts.length ? "badge-danger" : "badge-ok"}`}>
                {alerts.length} {alerts.length === 1 ? "alerta" : "alertas"}
              </span>
            </div>
            {alerts.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Ingrediente</th>
                      <th>Stock act.</th>
                      <th>Stock mín.</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.slice(0, 8).map((alert) => {
                      const critical = Number(alert.stock_current) <= 0;
                      return (
                        <tr key={alert.ingredient_id}>
                          <td>
                            <strong>{alert.name}</strong>
                            <p className="muted ops-sub">{alert.unit}</p>
                          </td>
                          <td className={critical ? "ops-stock-low" : ""}>
                            {formatStock(alert.stock_current, alert.unit)}
                          </td>
                          <td>{formatStock(alert.stock_minimum, alert.unit)}</td>
                          <td>
                            <span className={`badge ${critical ? "badge-danger" : "badge-warn"}`}>
                              {critical ? "Crítico" : "Bajo"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty">No hay ingredientes por debajo del mínimo.</div>
            )}
          </section>

          <section className="panel ops-panel">
            <div className="list-head">
              <h2>Movimientos recientes</h2>
              {movementsToday ? <span className="badge badge-edit">Hoy</span> : null}
            </div>
            {recentMovements.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Ingrediente</th>
                      <th>Tipo</th>
                      <th>Cantidad</th>
                      <th>Fecha / hora</th>
                      <th>Responsable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentMovements.map((item) => {
                      const tone = movementTone(item.type);
                      return (
                        <tr key={item.id}>
                          <td>
                            <strong>{item.ingredient?.name || `Ingrediente ${item.ingredient_id}`}</strong>
                            <p className="muted ops-sub">
                              {item.reason || item.ingredient?.unit || ""}
                            </p>
                          </td>
                          <td>
                            <span className={`ops-move ${tone}`}>
                              {movementLabel(item.type)}
                            </span>
                          </td>
                          <td className={`ops-qty ${tone}`}>
                            {movementSigned(item.type, item.quantity)}{" "}
                            {item.ingredient?.unit || ""}
                          </td>
                          <td>{formatTime(item.created_at)}</td>
                          <td>{item.user?.name || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty">Aún no hay movimientos de inventario.</div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
