import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { subscribeOpenOrder } from "../helpers/openOrder";
import { useAuth } from "../context/AuthContext";
import { catalogApi, ordersApi } from "../api/services";
import { ApiError } from "../api/client";
import type { Category, Dish, Order, OrderDetail } from "../types";
import {
  attentionLabel,
  isOffsiteOrder,
  kitchenStatusLabel,
  orderCodeLabel,
} from "../types";
import { formatDateTime } from "../helpers/datetime";
import { matchesQuery } from "../helpers/search";
import { useLiveReload } from "../context/LiveContext";
import { StatusLegend } from "../components/StatusLegend";
import {
  CancelOrderBox,
  ReturnDishBox,
  canCancelOrder,
  cancelStockHint,
  returnKindLabel,
  type DishReturnKind,
} from "../components/OrderStockActions";
import {
  isUnpaid,
  kitchenTone,
  orderTone,
  orderToneLabel,
  toneClass,
} from "../helpers/orderStatus";

type Shortage = {
  name: string;
  needed: number;
  available: number;
  dishes: string[];
};

function money(value: number | string) {
  return `S/ ${Number(value).toFixed(2)}`;
}

function dueOf(order: Order) {
  return Math.max(0, Number(order.total) - Number(order.amount_paid || 0));
}

function isSettled(order: Order) {
  return dueOf(order) <= 0.009;
}

function isSentToKitchen(detail: OrderDetail) {
  return detail.sent_to_kitchen === true;
}

function statusLabel(order: Order) {
  return orderToneLabel(orderTone(order), order.modality);
}

function statusClass(order: Order) {
  return toneClass(orderTone(order), isUnpaid(order));
}

export function DeliveryOrdersPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [params, setSearchParams] = useSearchParams();
  const wantedOrder = Number(params.get("order") || 0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [categoryId, setCategoryId] = useState<number | "all">("all");
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [shortages, setShortages] = useState<Shortage[]>([]);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancel, setShowCancel] = useState(false);
  const [returnDetail, setReturnDetail] = useState<OrderDetail | null>(null);
  const [returnKind, setReturnKind] = useState<DishReturnKind>("no_le_gusto");
  const [returnNote, setReturnNote] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [createModality, setCreateModality] = useState<"delivery" | "para_llevar">(
    "para_llevar"
  );
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [ticketOpen, setTicketOpen] = useState(true);
  const [dishQuery, setDishQuery] = useState("");

  const editing = activeOrder?.status === "en_edicion";
  const canEditItems =
    activeOrder?.status === "en_edicion" || activeOrder?.status === "confirmado";
  const details = activeOrder?.details || [];
  const sent = details.filter(isSentToKitchen);
  const unsent = details.filter((detail) => !isSentToKitchen(detail));
  const itemCount = details.reduce((sum, detail) => sum + Number(detail.quantity), 0);

  const openOrders = useMemo(
    () =>
      orders.filter(
        (order) => order.status === "en_edicion" || order.status === "confirmado"
      ),
    [orders]
  );
  const historyOrders = useMemo(
    () =>
      orders.filter(
        (order) => order.status === "cerrado" || order.status === "cancelado"
      ),
    [orders]
  );

  const visibleDishes = useMemo(() => {
    const list = dishes.filter((d) => d.is_active);
    const byCategory =
      !dishQuery.trim() && categoryId !== "all"
        ? list.filter((d) => d.category_id === categoryId)
        : list;
    return byCategory.filter((dish) =>
      matchesQuery(
        dishQuery,
        dish.name,
        dish.presentation,
        dish.category?.name,
        dish.description,
        Number(dish.price),
        `S/ ${Number(dish.price).toFixed(2)}`
      )
    );
  }, [dishes, categoryId, dishQuery]);

  const qtyByDish = useMemo(() => {
    const map = new Map<number, number>();
    for (const detail of details) {
      map.set(detail.dish_id, (map.get(detail.dish_id) || 0) + detail.quantity);
    }
    return map;
  }, [details]);

  const clearOrderQuery = () => {
    if (!params.get("order")) return;
    const next = new URLSearchParams(params);
    next.delete("order");
    setSearchParams(next, { replace: true });
  };

  const load = async (keepId?: number | null) => {
    if (!token) return;
    const [categoryList, dishList, orderList] = await Promise.all([
      catalogApi.listCategories(token, true),
      catalogApi.listDishes(token, true),
      ordersApi.list(token, "offsite"),
    ]);
    setCategories(categoryList.filter((c) => c.is_active));
    setDishes(dishList.filter((d) => d.is_active));
    setOrders(orderList);
    const id = keepId === null ? null : keepId ?? activeOrder?.id;
    if (!id) return;
    const refreshed =
      (await ordersApi.get(token, id).catch(() => null)) ||
      orderList.find((o) => o.id === id) ||
      null;
    setActiveOrder(refreshed);
    const nextNotes: Record<number, string> = {};
    for (const detail of refreshed?.details || []) {
      nextNotes[detail.id] = detail.observation || "";
    }
    setNotes(nextNotes);
  };

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof ApiError ? err.message : "Error al cargar")
    );
  }, [token]);

  const liveOrderId = useRef<number | null>(activeOrder?.id ?? null);
  useEffect(() => {
    liveOrderId.current = activeOrder?.id ?? null;
  }, [activeOrder?.id]);
  useLiveReload(["orders", "catalog", "kitchen"], () => {
    load(liveOrderId.current).catch(() => undefined);
  });

  useEffect(() => {
    if (activeOrder) setTicketOpen(true);
  }, [activeOrder?.id]);

  const applyOrder = async (order: Order) => {
    if (!isOffsiteOrder(order)) {
      navigate(`/orders?order=${order.id}`, { replace: true });
      return;
    }
    setActiveOrder(order);
    const nextNotes: Record<number, string> = {};
    for (const detail of order.details || []) {
      nextNotes[detail.id] = detail.observation || "";
    }
    setNotes(nextNotes);
    setShowCancel(false);
    await load(order.id);
  };

  const dismissTicket = async () => {
    liveOrderId.current = null;
    setActiveOrder(null);
    setShowCancel(false);
    clearOrderQuery();
    await load(null);
  };

  const openOrderById = (orderId: number) => {
    if (!token || !orderId) return;
    setError("");
    ordersApi
      .get(token, orderId)
      .then(async (order) => {
        if (order.status === "cerrado" || order.status === "cancelado") {
          clearOrderQuery();
          return;
        }
        await applyOrder(order);
        setTicketOpen(true);
      })
      .catch((err) =>
        setError(
          err instanceof ApiError ? err.message : "No se pudo abrir el pedido"
        )
      );
  };

  useEffect(() => {
    if (!token || !wantedOrder) return;
    openOrderById(wantedOrder);
  }, [token, wantedOrder]);

  useEffect(() => {
    if (!token) return;
    return subscribeOpenOrder((orderId) => {
      openOrderById(orderId);
    });
  }, [token]);

  const createDelivery = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const created = await ordersApi.openDelivery(token, {
        modality: createModality,
        delivery_customer_name: customerName.trim(),
        delivery_phone: phone.trim() || undefined,
        delivery_address:
          createModality === "delivery" ? address.trim() : undefined,
        delivery_note: note.trim() || undefined,
      });
      setShowCreate(false);
      setCreateModality("para_llevar");
      setCustomerName("");
      setPhone("");
      setAddress("");
      setNote("");
      setMessage(`Pedido ${orderCodeLabel(created)} abierto`);
      await applyOrder(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo abrir el delivery");
    } finally {
      setBusy(false);
    }
  };

  const addDish = async (dish: Dish) => {
    if (!token || !activeOrder || !canEditItems) return;
    setBusy(true);
    setError("");
    try {
      const next = await ordersApi.addDetail(token, activeOrder.id, {
        dish_id: dish.id,
        quantity: 1,
      });
      await applyOrder(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo agregar el plato");
    } finally {
      setBusy(false);
    }
  };

  const changeQty = async (detail: OrderDetail, quantity: number) => {
    if (!token || !activeOrder) return;
    setBusy(true);
    setError("");
    try {
      const next =
        quantity <= 0
          ? await ordersApi.removeDetail(token, activeOrder.id, detail.id)
          : await ordersApi.updateDetail(token, activeOrder.id, detail.id, {
              quantity,
            });
      await applyOrder(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo actualizar");
    } finally {
      setBusy(false);
    }
  };

  const saveNote = async (detail: OrderDetail) => {
    if (!token || !activeOrder) return;
    const observation = (notes[detail.id] || "").trim();
    if ((detail.observation || "") === observation) return;
    try {
      const next = await ordersApi.updateDetail(token, activeOrder.id, detail.id, {
        observation,
      });
      await applyOrder(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar la nota");
    }
  };

  const confirmOrder = async () => {
    if (!token || !activeOrder) return;
    setBusy(true);
    setError("");
    setShortages([]);
    try {
      const stock = await ordersApi.validateStock(token, activeOrder.id);
      if (!stock.ok) {
        setShortages(stock.shortages);
        throw new Error("No hay stock suficiente");
      }
      const next = await ordersApi.confirm(token, activeOrder.id);
      setMessage("Pedido confirmado y enviado a cocina");
      await applyOrder(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo confirmar");
    } finally {
      setBusy(false);
    }
  };

  const sendAdditions = async () => {
    if (!token || !activeOrder) return;
    setBusy(true);
    setError("");
    try {
      const next = await ordersApi.sendAdditions(token, activeOrder.id);
      setMessage("Extras enviados a cocina");
      await applyOrder(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron enviar los extras");
    } finally {
      setBusy(false);
    }
  };

  const markPaid = async (paid: boolean) => {
    if (!token || !activeOrder) return;
    setBusy(true);
    setError("");
    try {
      const next = await ordersApi.setPaid(token, activeOrder.id, paid);
      await applyOrder(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar el pago");
    } finally {
      setBusy(false);
    }
  };

  const closeOrder = async () => {
    if (!token || !activeOrder) return;
    setBusy(true);
    setError("");
    try {
      await ordersApi.close(token, activeOrder.id);
      await dismissTicket();
      setMessage("Pedido cerrado");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cerrar");
    } finally {
      setBusy(false);
    }
  };

  const cancelOrder = async () => {
    if (!token || !activeOrder) return;
    setBusy(true);
    setError("");
    try {
      await ordersApi.cancel(token, activeOrder.id, cancelReason);
      await dismissTicket();
      setMessage("Pedido cancelado");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cancelar");
    } finally {
      setBusy(false);
    }
  };

  const returnDish = async () => {
    if (!token || !activeOrder || !returnDetail) return;
    setBusy(true);
    setError("");
    try {
      const order = await ordersApi.returnDetail(
        token,
        activeOrder.id,
        returnDetail.id,
        { kind: returnKind, note: returnNote }
      );
      setMessage(
        returnKind === "defecto"
          ? "Defecto registrado. El plato no se cobra. Si lo cambias, agrégalo otra vez."
          : "Devolución registrada. El plato se cobra igual."
      );
      setReturnDetail(null);
      setReturnNote("");
      await applyOrder(order);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "No se pudo registrar la devolución"
      );
    } finally {
      setBusy(false);
    }
  };

  const renderLine = (detail: OrderDetail) => {
    const sentLine = isSentToKitchen(detail);
    const canChangeQty = canEditItems && !sentLine;
    const alerts = shortages.filter((item) => item.dishes.includes(detail.dish?.name || ""));
    return (
      <article
        key={detail.id}
        className={`pos-line${
          sentLine ? ` st-band ${toneClass(kitchenTone(detail.kitchen_status))}` : ""
        }`}
      >
        <div className="pos-line-main">
          <div>
            <strong>{detail.dish?.name || `Plato ${detail.dish_id}`}</strong>
            {detail.dish?.presentation ? (
              <p className="muted">{detail.dish.presentation}</p>
            ) : null}
            <p className="muted">{money(detail.unit_price)} c/u</p>
          </div>
          <strong className="pos-line-sum">
            {money(
              detail.charged === false
                ? 0
                : Number(detail.unit_price) * Number(detail.quantity)
            )}
          </strong>
        </div>
        {canChangeQty ? (
          <div className="pos-line-actions">
            <div className="pos-qty">
              <button type="button" disabled={busy} onClick={() => changeQty(detail, detail.quantity - 1)}>
                −
              </button>
              <span>{detail.quantity}</span>
              <button type="button" disabled={busy} onClick={() => changeQty(detail, detail.quantity + 1)}>
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
            {sentLine
              ? ` · ${kitchenStatusLabel(
                  detail.kitchen_status || "pendiente",
                  activeOrder?.modality
                )}`
              : ""}
          </p>
        )}
        {canChangeQty ? (
          <input
            className="pos-note"
            value={notes[detail.id] ?? ""}
            placeholder="Nota para cocina…"
            onChange={(e) =>
              setNotes((prev) => ({ ...prev, [detail.id]: e.target.value }))
            }
            onBlur={() => saveNote(detail)}
          />
        ) : detail.observation ? (
          <p className="muted">Nota: {detail.observation}</p>
        ) : null}
        {detail.return_kind ? (
          <p className="muted">{returnKindLabel(detail.return_kind)}</p>
        ) : activeOrder?.status === "confirmado" && sentLine ? (
          returnDetail?.id === detail.id ? (
            <ReturnDishBox
              detail={detail}
              kind={returnKind}
              note={returnNote}
              onKind={setReturnKind}
              onNote={setReturnNote}
              busy={busy}
              onConfirm={() => void returnDish()}
              onClose={() => setReturnDetail(null)}
            />
          ) : (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => {
                setShowCancel(false);
                setReturnKind("no_le_gusto");
                setReturnNote("");
                setReturnDetail(detail);
              }}
            >
              Devolver / merma
            </button>
          )
        ) : null}
        {alerts.map((alert) => (
          <p key={alert.name} className="pos-stock-warn">
            Stock insuficiente de {alert.name} (solo quedan {alert.available})
          </p>
        ))}
      </article>
    );
  };

  if (!activeOrder) {
    return (
      <div>
        <div className="page-head">
          <div>
            <h1>Delivery y para llevar</h1>
            <StatusLegend variant="delivery" />
          </div>
          <div className="actions">
            <button
              type="button"
              className={`btn ${showHistory ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setShowHistory((open) => !open)}
            >
              Historial
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setShowHistory(false);
                setShowCreate(true);
              }}
            >
              Nuevo pedido
            </button>
          </div>
        </div>
        {error ? <div className="alert alert-error">{error}</div> : null}
        {message ? <div className="alert alert-ok">{message}</div> : null}

        <section className="panel">
          <div className="list-head">
            <div>
              <h2>{showHistory ? "Historial" : "En curso"}</h2>
              <p>
                {showHistory
                  ? `${historyOrders.length} ${
                      historyOrders.length === 1 ? "pedido cerrado" : "pedidos cerrados o cancelados"
                    }`
                  : `${openOrders.length} ${openOrders.length === 1 ? "pedido" : "pedidos"}`}
              </p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Orden</th>
                  <th>Tipo</th>
                  <th>Cliente</th>
                  <th>Teléfono</th>
                  <th>Estado</th>
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(showHistory ? historyOrders : openOrders).map((order) => (
                  <tr
                    key={order.id}
                    className={`st-band ${statusClass(order)}`}
                  >
                    <td>
                      <strong>{orderCodeLabel(order)}</strong>
                      <div className="hint">
                        {order.waiter?.name || "Sin responsable"} ·{" "}
                        {formatDateTime(order.created_at)}
                      </div>
                    </td>
                    <td>{attentionLabel(order.modality)}</td>
                    <td>{order.delivery_customer_name || "—"}</td>
                    <td>{order.delivery_phone || "—"}</td>
                    <td>
                      <span className={`badge ${statusClass(order)}`}>
                        {statusLabel(order)}
                      </span>
                    </td>
                    <td>{money(order.total)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => applyOrder(order)}
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!(showHistory ? historyOrders : openOrders).length ? (
              <div className="empty">
                {showHistory
                  ? "Aún no hay historial de delivery ni para llevar"
                  : "No hay pedidos en curso"}
              </div>
            ) : null}
          </div>
        </section>

        {showCreate ? (
          <div
            className="dialog-backdrop"
            role="presentation"
            onClick={() => {
              if (!busy) setShowCreate(false);
            }}
          >
            <div
              className="dialog dialog-wide panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delivery-form-title"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 id="delivery-form-title">Nuevo pedido</h2>
              {error ? <div className="alert alert-error">{error}</div> : null}
              <form className="form-grid" onSubmit={createDelivery}>
                <div className="page-tabs" role="tablist" aria-label="Tipo de pedido">
                  <button
                    type="button"
                    role="tab"
                    className={`page-tab${createModality === "para_llevar" ? " active" : ""}`}
                    onClick={() => setCreateModality("para_llevar")}
                  >
                    Para llevar
                  </button>
                  <button
                    type="button"
                    role="tab"
                    className={`page-tab${createModality === "delivery" ? " active" : ""}`}
                    onClick={() => setCreateModality("delivery")}
                  >
                    Delivery
                  </button>
                </div>
                <div className="form-row">
                  <label>
                    Nombre del cliente
                    <input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Teléfono {createModality === "para_llevar" ? "(opcional)" : ""}
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required={createModality === "delivery"}
                    />
                  </label>
                </div>
                {createModality === "delivery" ? (
                  <label>
                    Dirección
                    <input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      required
                    />
                  </label>
                ) : null}
                <label>
                  Nota (opcional)
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={
                      createModality === "delivery"
                        ? "Referencia, hora, pago contra entrega…"
                        : "Sin cubiertos, para recoger…"
                    }
                  />
                </label>
                <div className="form-footer">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setShowCreate(false)}
                    disabled={busy}
                  >
                    Cancelar
                  </button>
                  <button className="btn btn-primary" type="submit" disabled={busy}>
                    {busy ? "Abriendo..." : "Abrir pedido"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
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
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                void dismissTicket();
              }}
            >
              Pedidos
            </button>
            <div>
              <h1>
                {attentionLabel(activeOrder.modality)} {orderCodeLabel(activeOrder)}
              </h1>
              <p>
                {activeOrder.delivery_customer_name}
                {activeOrder.delivery_phone ? ` · ${activeOrder.delivery_phone}` : ""}
              </p>
            </div>
            <span className={`badge ${statusClass(activeOrder)}`}>
              {statusLabel(activeOrder)}
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
              <input
                className="pos-search"
                value={dishQuery}
                onChange={(e) => setDishQuery(e.target.value)}
                placeholder="Buscar plato, categoría, precio…"
              />
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
                    className={`category-tab ${categoryId === category.id ? "active" : ""}`}
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
                        <em>{dish.presentation || dish.category?.name || "Carta"}</em>
                      </span>
                      <span className="pos-dish-price">{money(dish.price)}</span>
                      <span className="pos-dish-add">{qty ? `+ · ${qty}` : "+"}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="empty">Este pedido ya no se puede editar.</div>
          )}
        </section>
      </div>

      {createPortal(
        <div className={`pos-ticket-layer${ticketOpen ? " open" : ""}`}>
          <button
            type="button"
            className="pos-ticket-backdrop"
            aria-label="Cerrar pedido"
            onClick={() => setTicketOpen(false)}
          />
          <aside
            className={`pos-ticket st-band ${statusClass(activeOrder)}`}
          >
            <div className="pos-ticket-head">
              <div>
                <h2>Pedido {orderCodeLabel(activeOrder)}</h2>
                <p>
                  {attentionLabel(activeOrder.modality)} ·{" "}
                  {activeOrder.delivery_customer_name} ·{" "}
                  {activeOrder.waiter?.name || "Sin responsable"} ·{" "}
                  {formatDateTime(activeOrder.created_at)}
                </p>
                <p className="hint">
                  {activeOrder.delivery_address}
                  {activeOrder.delivery_note ? ` · ${activeOrder.delivery_note}` : ""}
                </p>
              </div>
              <button
                type="button"
                className="pos-ticket-close"
                onClick={() => setTicketOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="pos-ticket-lines">
              {!details.length ? (
                <p className="muted">Aún no hay platos en el ticket.</p>
              ) : activeOrder.status === "confirmado" ? (
                <>
                  <section className="pos-ticket-group">
                    <h3>Enviado a cocina</h3>
                    {sent.length ? sent.map(renderLine) : <p className="muted">Todavía no hay platos en cocina.</p>}
                  </section>
                  <section className="pos-ticket-group">
                    <h3>Extras</h3>
                    {unsent.length ? unsent.map(renderLine) : <p className="muted">Sin extras pendientes.</p>}
                  </section>
                </>
              ) : (
                details.map(renderLine)
              )}
            </div>
            <div className="pos-totals">
              <div className="pos-total">
                <span>TOTAL</span>
                <strong>{money(activeOrder.total)}</strong>
              </div>
              {activeOrder.status === "confirmado" ? (
                <div>
                  <span>Por cobrar</span>
                  <strong>{money(dueOf(activeOrder))}</strong>
                </div>
              ) : null}
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
                  <CancelOrderBox
                    order={activeOrder}
                    reason={cancelReason}
                    onReason={setCancelReason}
                    busy={busy}
                    onConfirm={() => void cancelOrder()}
                    onClose={() => setShowCancel(false)}
                  />
                ) : (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setReturnDetail(null);
                      setShowCancel(true);
                    }}
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
                  className={`btn pos-confirm ${isSettled(activeOrder) ? "btn-ghost" : "btn-primary"}`}
                  disabled={busy}
                  onClick={() => markPaid(!isSettled(activeOrder))}
                >
                  {isSettled(activeOrder) ? "Desmarcar pago" : "Marcar como pagado"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy || !isSettled(activeOrder) || unsent.length > 0}
                  onClick={closeOrder}
                >
                  Cerrar pedido
                </button>
                {showCancel ? (
                  <CancelOrderBox
                    order={activeOrder}
                    reason={cancelReason}
                    onReason={setCancelReason}
                    busy={busy}
                    onConfirm={() => void cancelOrder()}
                    onClose={() => setShowCancel(false)}
                  />
                ) : canCancelOrder(activeOrder) ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busy}
                    onClick={() => {
                      setReturnDetail(null);
                      setShowCancel(true);
                    }}
                  >
                    Cancelar pedido
                  </button>
                ) : (
                  <p className="muted">{cancelStockHint(activeOrder)}</p>
                )}
              </div>
            ) : null}
          </aside>
        </div>,
        document.body
      )}
    </div>
  );
}
