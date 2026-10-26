import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import { catalogApi, ordersApi } from "../api/services";
import { ApiError } from "../api/client";
import type { Category, Dish, Order, OrderDetail, TableItem } from "../types";
import { dishLabel, orderCodeLabel } from "../types";
import { formatTime } from "../helpers/datetime";

type Shortage = {
  name: string;
  needed: number;
  available: number;
  dishes: string[];
};

function money(value: number | string) {
  return `S/ ${Number(value).toFixed(2)}`;
}

function statusLabel(status: Order["status"]) {
  if (status === "en_edicion") return "En edición";
  if (status === "confirmado") return "En mesa";
  if (status === "cerrado") return "Cerrado";
  return "Cancelado";
}

function statusClass(status: Order["status"]) {
  if (status === "en_edicion") return "badge-edit";
  if (status === "confirmado") return "badge-ok";
  if (status === "cerrado") return "badge-ok";
  return "badge-danger";
}

function dueOf(order: Order) {
  return Math.max(0, Number(order.total) - Number(order.amount_paid || 0));
}

function isSettled(order: Order) {
  return dueOf(order) <= 0.009;
}

function tableState(order?: Order) {
  if (!order) return { label: "Libre", className: "" };
  if (order.status === "en_edicion") {
    return { label: "En edición", className: "occupied" };
  }
  const due = dueOf(order);
  const unpaid = due > 0.009 ? " · Sin pagar" : " · Pagado";
  const kitchen = order.kitchen_ticket?.status;
  if (kitchen === "entregado" || kitchen === "listo") {
    return {
      label: `Comiendo${unpaid}`,
      className: `occupied dining${due > 0.009 ? " unpaid" : ""}`,
    };
  }
  return {
    label: `En cocina${unpaid}`,
    className: `occupied kitchen${due > 0.009 ? " unpaid" : ""}`,
  };
}

function kitchenLabel(status?: string) {
  if (status === "pendiente") return "pendiente";
  if (status === "en_preparacion") return "en preparación";
  if (status === "listo") return "listo para servir";
  if (status === "entregado") return "entregado en mesa";
  return status || "";
}

function lineTotal(detail: OrderDetail) {
  return Number(detail.unit_price) * Number(detail.quantity);
}

export function OrdersPage() {
  const { token, user } = useAuth();
  const [tables, setTables] = useState<TableItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [categoryId, setCategoryId] = useState<number | "all">("all");
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [shortages, setShortages] = useState<Shortage[]>([]);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancel, setShowCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [ticketOpen, setTicketOpen] = useState(true);

  const editing = activeOrder?.status === "en_edicion";
  const canEditItems =
    activeOrder?.status === "en_edicion" || activeOrder?.status === "confirmado";
  const details = activeOrder?.details || [];
  const unsent = details.filter((detail) => !detail.sent_to_kitchen);
  const itemCount = details.reduce((sum, detail) => sum + Number(detail.quantity), 0);

  const openByTable = useMemo(() => {
    const map = new Map<number, Order>();
    for (const order of orders) {
      if (order.status === "en_edicion" || order.status === "confirmado") {
        map.set(order.table_id, order);
      }
    }
    return map;
  }, [orders]);

  const visibleDishes = useMemo(() => {
    const list = dishes.filter((d) => d.is_active);
    if (categoryId === "all") return list;
    return list.filter((d) => d.category_id === categoryId);
  }, [dishes, categoryId]);

  const qtyByDish = useMemo(() => {
    const map = new Map<number, number>();
    for (const detail of details) {
      map.set(detail.dish_id, (map.get(detail.dish_id) || 0) + detail.quantity);
    }
    return map;
  }, [details]);

  const load = async (keepId?: number) => {
    if (!token) return;
    const [tableList, categoryList, dishList, orderList] = await Promise.all([
      ordersApi.listTables(token),
      catalogApi.listCategories(token, true),
      catalogApi.listDishes(token, true),
      ordersApi.list(token),
    ]);
    setTables(tableList.filter((t) => t.is_active));
    setCategories(categoryList.filter((c) => c.is_active));
    setDishes(dishList.filter((d) => d.is_active));
    setOrders(orderList);
    const id = keepId ?? activeOrder?.id;
    if (id) {
      const refreshed =
        orderList.find((o) => o.id === id) ||
        (await ordersApi.get(token, id).catch(() => null));
      setActiveOrder(refreshed || null);
      const nextNotes: Record<number, string> = {};
      for (const detail of refreshed?.details || []) {
        nextNotes[detail.id] = detail.observation || "";
      }
      setNotes(nextNotes);
    }
  };

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof ApiError ? err.message : "Error al cargar")
    );
  }, [token]);

  useEffect(() => {
    if (activeOrder) setTicketOpen(true);
  }, [activeOrder?.id]);

  useEffect(() => {
    if (!ticketOpen || !activeOrder) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTicketOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [ticketOpen, activeOrder]);

  const checkStock = async (orderId: number) => {
    if (!token) return;
    try {
      const result = await ordersApi.validateStock(token, orderId);
      setShortages(result.ok ? [] : result.shortages);
    } catch {
      setShortages([]);
    }
  };

  const applyOrder = async (order: Order) => {
    setActiveOrder(order);
    const nextNotes: Record<number, string> = {};
    for (const detail of order.details || []) {
      nextNotes[detail.id] = detail.observation || "";
    }
    setNotes(nextNotes);
    if (order.status === "en_edicion" || order.status === "confirmado") {
      await checkStock(order.id);
    } else {
      setShortages([]);
    }
    await load(order.id);
  };

  const pickTable = async (table: TableItem) => {
    if (!token) return;
    setError("");
    setMessage("");
    const existing = openByTable.get(table.id);
    if (existing) {
      await applyOrder(existing);
      return;
    }
    setBusy(true);
    try {
      const order = await ordersApi.open(token, table.id);
      setMessage(`Pedido abierto en Mesa ${table.number}`);
      await applyOrder(order);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo abrir el pedido");
    } finally {
      setBusy(false);
    }
  };

  const addDish = async (dish: Dish) => {
    if (!token || !activeOrder || !canEditItems) return;
    setError("");
    setBusy(true);
    try {
      const same = details.find(
        (d) =>
          d.dish_id === dish.id &&
          !(d.observation || "").trim() &&
          !d.sent_to_kitchen
      );
      const order = same
        ? await ordersApi.updateDetail(token, activeOrder.id, same.id, {
            quantity: same.quantity + 1,
          })
        : await ordersApi.addDetail(token, activeOrder.id, {
            dish_id: dish.id,
            quantity: 1,
          });
      await applyOrder(order);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo agregar");
    } finally {
      setBusy(false);
    }
  };

  const changeQty = async (detail: OrderDetail, quantity: number) => {
    if (!token || !activeOrder || !canEditItems) return;
    if (detail.sent_to_kitchen) return;
    setBusy(true);
    try {
      const order =
        quantity <= 0
          ? await ordersApi.removeDetail(token, activeOrder.id, detail.id)
          : await ordersApi.updateDetail(token, activeOrder.id, detail.id, {
              quantity,
            });
      await applyOrder(order);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo actualizar");
    } finally {
      setBusy(false);
    }
  };

  const saveNote = async (detail: OrderDetail) => {
    if (!token || !activeOrder || !canEditItems) return;
    const next = (notes[detail.id] || "").trim();
    if (next === (detail.observation || "").trim()) return;
    try {
      const order = await ordersApi.updateDetail(token, activeOrder.id, detail.id, {
        observation: next,
      });
      await applyOrder(order);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar la nota");
    }
  };

  const confirmOrder = async () => {
    if (!token || !activeOrder || !details.length) return;
    setError("");
    setBusy(true);
    try {
      const order = await ordersApi.confirm(token, activeOrder.id);
      setMessage("Pedido enviado a cocina. Puedes agregar extras o cobrar.");
      await applyOrder(order);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo confirmar");
    } finally {
      setBusy(false);
    }
  };

  const cancelOrder = async () => {
    if (!token || !activeOrder) return;
    setError("");
    setBusy(true);
    try {
      await ordersApi.cancel(token, activeOrder.id, cancelReason);
      setMessage("Pedido cancelado");
      setCancelReason("");
      setShowCancel(false);
      setActiveOrder(null);
      setShortages([]);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cancelar");
    } finally {
      setBusy(false);
    }
  };

  const sendAdditions = async () => {
    if (!token || !activeOrder || !unsent.length) return;
    setError("");
    setBusy(true);
    try {
      const order = await ordersApi.sendAdditions(token, activeOrder.id);
      setMessage("Los platos extra se enviaron a cocina");
      await applyOrder(order);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo enviar a cocina");
    } finally {
      setBusy(false);
    }
  };

  const markPaid = async (paid: boolean) => {
    if (!token || !activeOrder) return;
    setError("");
    setBusy(true);
    try {
      const order = await ordersApi.setPaid(token, activeOrder.id, paid);
      setMessage(paid ? "Pago registrado" : "Pago desmarcado");
      await applyOrder(order);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo actualizar el pago");
    } finally {
      setBusy(false);
    }
  };

  const closeTable = async () => {
    if (!token || !activeOrder) return;
    setError("");
    setBusy(true);
    try {
      await ordersApi.close(token, activeOrder.id);
      setMessage("Mesa liberada. Los comensales ya se fueron.");
      setActiveOrder(null);
      setShortages([]);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo liberar la mesa");
    } finally {
      setBusy(false);
    }
  };

  const backToTables = () => {
    setActiveOrder(null);
    setShortages([]);
    setShowCancel(false);
    setError("");
  };

  const shortageFor = (detail: OrderDetail) => {
    const name = detail.dish ? dishLabel(detail.dish) : "";
    return shortages.filter(
      (s) => s.dishes.includes(name) || s.dishes.includes(detail.dish?.name || "")
    );
  };

  if (!activeOrder) {
    return (
      <div className="pos-page">
        <div className="page-head">
          <div>
            <h1>Toma de pedidos</h1>
            <p>
              Elige una mesa para abrir o seguir un pedido. Pensado para usar
              desde tablet en el salón.
            </p>
          </div>
        </div>
        {error ? <div className="alert alert-error">{error}</div> : null}
        {message ? <div className="alert alert-ok">{message}</div> : null}

        <section className="panel">
          <h2>Mesas</h2>
          <div className="table-grid">
            {tables.map((table) => {
              const open = openByTable.get(table.id);
              const state = tableState(open);
              return (
                <button
                  key={table.id}
                  type="button"
                  className={`table-tile ${state.className}`}
                  disabled={busy}
                  onClick={() => pickTable(table)}
                >
                  <strong>Mesa {String(table.number).padStart(2, "0")}</strong>
                  <span>{state.label}</span>
                  {open ? <em>{money(open.total)}</em> : null}
                </button>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="pos-page pos-live">
      {error ? <div className="alert alert-error">{error}</div> : null}
      {message ? <div className="alert alert-ok">{message}</div> : null}

      <div className="pos-layout">
        <section className="pos-menu">
          <div className="pos-menu-head">
            <button type="button" className="btn btn-ghost" onClick={backToTables}>
              Mesas
            </button>
            <div>
              <h1>
                Toma de pedido — Mesa{" "}
                {String(activeOrder.table?.number ?? activeOrder.table_id).padStart(
                  2,
                  "0"
                )}
              </h1>
              <p>
                {editing
                  ? "Selecciona platos para agregar al ticket"
                  : "Puedes agregar más platos si piden extra"}
              </p>
            </div>
            <span className={`badge ${statusClass(activeOrder.status)}`}>
              {statusLabel(activeOrder.status)}
            </span>
            <button
              type="button"
              className="btn btn-primary pos-ticket-toggle"
              onClick={() => setTicketOpen(true)}
            >
              Ver pedido{itemCount ? ` · ${itemCount}` : ""}
            </button>
          </div>

          {canEditItems ? (
            <>
              <div className="category-tabs pos-tabs">
                <button
                  type="button"
                  className={`category-tab ${categoryId === "all" ? "active" : ""}`}
                  onClick={() => setCategoryId("all")}
                >
                  Todos
                </button>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    className={`category-tab ${
                      categoryId === category.id ? "active" : ""
                    }`}
                    onClick={() => setCategoryId(category.id)}
                  >
                    {category.name}
                  </button>
                ))}
              </div>

              <div className="pos-dish-list">
                {visibleDishes.map((dish) => {
                  const qty = qtyByDish.get(dish.id) || 0;
                  return (
                    <button
                      key={dish.id}
                      type="button"
                      className="pos-dish-row"
                      disabled={busy}
                      onClick={() => addDish(dish)}
                    >
                      <span className="pos-dish-info">
                        <strong>{dish.name}</strong>
                        {dish.presentation ? (
                          <em>{dish.presentation}</em>
                        ) : (
                          <em>{dish.category?.name || "Carta"}</em>
                        )}
                      </span>
                      <span className="pos-dish-price">{money(dish.price)}</span>
                      <span className="pos-dish-add">
                        {qty ? `+ · ${qty}` : "+"}
                      </span>
                    </button>
                  );
                })}
              </div>
              {!visibleDishes.length ? (
                <div className="empty">No hay platos en esta categoría</div>
              ) : null}
            </>
          ) : (
            <div className="empty">
              {activeOrder.status === "confirmado"
                ? "El pedido ya está en cocina o en la mesa. La mesa sigue ocupada hasta que los comensales se vayan."
                : "Este pedido ya no se puede editar."}
            </div>
          )}
        </section>
      </div>

      {!ticketOpen
        ? createPortal(
            <button
              type="button"
              className="pos-ticket-fab"
              onClick={() => setTicketOpen(true)}
            >
              <strong>Pedido</strong>
              <span>
                {itemCount ? `${itemCount} plato${itemCount === 1 ? "" : "s"}` : "Vacío"}
                {" · "}
                {money(activeOrder.total)}
              </span>
            </button>,
            document.body
          )
        : null}

      {createPortal(
        <div className={`pos-ticket-layer${ticketOpen ? " open" : ""}`}>
          <button
            type="button"
            className="pos-ticket-backdrop"
            aria-label="Cerrar pedido"
            tabIndex={ticketOpen ? 0 : -1}
            onClick={() => setTicketOpen(false)}
          />
          <aside className="pos-ticket" aria-hidden={!ticketOpen}>
          <div className="pos-ticket-head">
            <div>
              <h2>Pedido {orderCodeLabel(activeOrder)}</h2>
              <p>
                Mesa{" "}
                {String(activeOrder.table?.number ?? activeOrder.table_id).padStart(
                  2,
                  "0"
                )}{" "}
                · {formatTime(activeOrder.created_at)} ·{" "}
                {activeOrder.waiter?.name || user?.name || "Mesero"}
              </p>
            </div>
            <div className="pos-ticket-head-actions">
              {activeOrder.kitchen_ticket ? (
                <span className="muted">
                  {kitchenLabel(activeOrder.kitchen_ticket.status)}
                </span>
              ) : null}
              <button
                type="button"
                className="pos-ticket-close"
                aria-label="Cerrar pedido"
                onClick={() => setTicketOpen(false)}
              >
                ×
              </button>
            </div>
          </div>

          <div className="pos-ticket-lines">
            {!details.length ? (
              <p className="muted">Aún no hay platos en el ticket.</p>
            ) : (
              details.map((detail) => {
                const alerts = shortageFor(detail);
                const canChangeQty = canEditItems && !detail.sent_to_kitchen;
                return (
                  <article
                    key={detail.id}
                    className={`pos-line ${alerts.length ? "warn" : ""} ${
                      canChangeQty && !editing ? "pending" : ""
                    }`}
                  >
                    <div className="pos-line-top">
                      <div>
                        <strong>
                          {detail.dish?.name || `Plato ${detail.dish_id}`}
                        </strong>
                        {detail.dish?.presentation ? (
                          <p className="muted">{detail.dish.presentation}</p>
                        ) : null}
                        <p className="muted">{money(detail.unit_price)} c/u</p>
                      </div>
                      <strong className="pos-line-sum">{money(lineTotal(detail))}</strong>
                    </div>
                    {canChangeQty ? (
                      <div className="pos-line-actions">
                        <div className="pos-qty">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => changeQty(detail, detail.quantity - 1)}
                          >
                            −
                          </button>
                          <span>{detail.quantity}</span>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => changeQty(detail, detail.quantity + 1)}
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          className="pos-remove"
                          disabled={busy}
                          onClick={() => changeQty(detail, 0)}
                        >
                          Eliminar
                        </button>
                      </div>
                    ) : (
                      <p className="muted">
                        Cantidad: {detail.quantity}
                        {detail.sent_to_kitchen ? " · En cocina / mesa" : ""}
                      </p>
                    )}
                    {canChangeQty ? (
                      <input
                        className="pos-note"
                        value={notes[detail.id] ?? ""}
                        placeholder="Nota: término, sin salsa…"
                        onChange={(e) =>
                          setNotes((prev) => ({
                            ...prev,
                            [detail.id]: e.target.value,
                          }))
                        }
                        onBlur={() => saveNote(detail)}
                      />
                    ) : detail.observation ? (
                      <p className="muted">Nota: {detail.observation}</p>
                    ) : null}
                    {canChangeQty && !editing ? (
                      <p className="pos-stock-warn">Por enviar a cocina</p>
                    ) : null}
                    {alerts.map((alert) => (
                      <p key={alert.name} className="pos-stock-warn">
                        Stock insuficiente de {alert.name} (solo quedan{" "}
                        {alert.available})
                      </p>
                    ))}
                  </article>
                );
              })
            )}
          </div>

          <div className="pos-totals">
            <div>
              <span>Total</span>
              <span>{money(activeOrder.total)}</span>
            </div>
            {activeOrder.status === "confirmado" ? (
              <>
                <div>
                  <span>Ya pagado</span>
                  <span className="ops-qty in">
                    {money(activeOrder.amount_paid || 0)}
                  </span>
                </div>
                <div className="pos-total">
                  <span>Por cobrar</span>
                  <strong className={dueOf(activeOrder) > 0.009 ? "ops-qty out" : ""}>
                    {money(dueOf(activeOrder))}
                  </strong>
                </div>
              </>
            ) : (
              <div className="pos-total">
                <span>TOTAL</span>
                <strong>{money(activeOrder.total)}</strong>
              </div>
            )}
          </div>

          {editing ? (
            <div className="pos-ticket-foot">
              <button
                type="button"
                className="btn btn-primary pos-confirm"
                disabled={busy || !details.length}
                onClick={confirmOrder}
              >
                Confirmar pedido
              </button>
              {showCancel ? (
                <div className="pos-cancel">
                  <input
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Motivo de cancelación"
                  />
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={busy}
                    onClick={cancelOrder}
                  >
                    Confirmar cancelación
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowCancel(true)}
                >
                  Cancelar pedido
                </button>
              )}
            </div>
          ) : activeOrder.status === "confirmado" ? (
            <div className="pos-ticket-foot">
              {unsent.length ? (
                <button
                  type="button"
                  className="btn btn-primary pos-confirm"
                  disabled={busy}
                  onClick={sendAdditions}
                >
                  Enviar extras a cocina ({unsent.length})
                </button>
              ) : null}
              <button
                type="button"
                className={`btn pos-confirm ${
                  isSettled(activeOrder) ? "btn-ghost" : "btn-primary"
                }`}
                disabled={busy}
                onClick={() => markPaid(!isSettled(activeOrder))}
              >
                {isSettled(activeOrder)
                  ? "Desmarcar pago"
                  : Number(activeOrder.amount_paid || 0) > 0
                    ? `Cobrar saldo ${money(dueOf(activeOrder))}`
                    : "Marcar como pagado"}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy || !isSettled(activeOrder) || unsent.length > 0}
                onClick={closeTable}
              >
                Liberar mesa
              </button>
            </div>
          ) : activeOrder.kitchen_ticket ? (
            <p className="muted">
              Comanda: {kitchenLabel(activeOrder.kitchen_ticket.status)}
            </p>
          ) : null}
          </aside>
        </div>,
        document.body
      )}
    </div>
  );
}
