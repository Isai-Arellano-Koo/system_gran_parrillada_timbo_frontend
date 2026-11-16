import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { catalogApi, ordersApi } from "../api/services";
import { ApiError } from "../api/client";
import type { Category, Dish, Order, OrderDetail, TableItem } from "../types";
import {
  dishLabel,
  kitchenStatusLabel,
  orderCodeLabel,
  tableNumbers,
  tablesLabel,
} from "../types";
import { formatTime } from "../helpers/datetime";
import { matchesQuery } from "../helpers/search";

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
  if (kitchen === "entregado") {
    return {
      label: `En mesa${unpaid}`,
      className: `occupied dining${due > 0.009 ? " unpaid" : ""}`,
    };
  }
  if (kitchen === "listo") {
    return {
      label: `Por entregar${unpaid}`,
      className: `occupied ready${due > 0.009 ? " unpaid" : ""}`,
    };
  }
  return {
    label: `En cocina${unpaid}`,
    className: `occupied kitchen${due > 0.009 ? " unpaid" : ""}`,
  };
}

function lineTotal(detail: OrderDetail) {
  return Number(detail.unit_price) * Number(detail.quantity);
}

const TABLE_HOLD_MS = 450;

function isSentToKitchen(detail: OrderDetail) {
  return detail.sent_to_kitchen === true;
}

export function OrdersPage() {
  const { token, user } = useAuth();
  const [params] = useSearchParams();
  const wantedOrder = Number(params.get("order") || 0);
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
  const [dishQuery, setDishQuery] = useState("");

  const editing = activeOrder?.status === "en_edicion";
  const canEditItems =
    activeOrder?.status === "en_edicion" || activeOrder?.status === "confirmado";
  const details = activeOrder?.details || [];
  const sent = details.filter(isSentToKitchen);
  const unsent = details.filter((detail) => !isSentToKitchen(detail));
  const itemCount = details.reduce((sum, detail) => sum + Number(detail.quantity), 0);

  const openByTable = useMemo(() => {
    const map = new Map<number, Order>();
    for (const order of orders) {
      if (order.modality !== "mesa") continue;
      if (order.status !== "en_edicion" && order.status !== "confirmado") continue;
      const ids = (order.tables?.length
        ? order.tables.map((table) => table.id)
        : order.table_id
          ? [order.table_id]
          : []) as number[];
      for (const id of ids) map.set(id, order);
    }
    return map;
  }, [orders]);

  const pointer = useRef<{
    tableId: number;
    number: number;
    startX: number;
    startY: number;
    dragging: boolean;
    armed: boolean;
    cancelled: boolean;
    pointerId: number;
    pointerType: string;
  } | null>(null);
  const holdTimer = useRef<number | null>(null);
  const overRef = useRef<number | null>(null);
  const joinSourceRef = useRef<number | null>(null);
  const nativeTouch = useRef<{
    move: (event: TouchEvent) => void;
    end: (event: TouchEvent) => void;
    cancel: () => void;
  } | null>(null);
  const [ghost, setGhost] = useState<{ number: number; x: number; y: number } | null>(
    null
  );
  const [overId, setOverId] = useState<number | null>(null);
  const [holdingId, setHoldingId] = useState<number | null>(null);
  const [joinSource, setJoinSource] = useState<number | null>(null);

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
    if (!token || !wantedOrder) return;
    ordersApi
      .get(token, wantedOrder)
      .then((order) => applyOrder(order))
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "No se pudo abrir el pedido")
      );
  }, [token, wantedOrder]);

  useEffect(
    () => () => {
      if (holdTimer.current != null) window.clearTimeout(holdTimer.current);
      if (nativeTouch.current) {
        document.removeEventListener("touchmove", nativeTouch.current.move);
        document.removeEventListener("touchend", nativeTouch.current.end);
        document.removeEventListener("touchcancel", nativeTouch.current.cancel);
      }
    },
    []
  );

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

  const joinTables = async (fromId: number, toId: number) => {
    if (!token || fromId === toId) return;
    setBusy(true);
    setError("");
    try {
      const order = await ordersApi.joinTables(token, fromId, toId);
      setMessage(`${tablesLabel(order)} en un solo pedido`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron unir las mesas");
    } finally {
      setBusy(false);
    }
  };

  const tableFromPoint = (x: number, y: number) => {
    const hit = document.elementFromPoint(x, y)?.closest("[data-table-id]");
    if (!(hit instanceof HTMLElement)) return null;
    const id = Number(hit.dataset.tableId);
    return Number.isFinite(id) ? id : null;
  };

  const clearHoldTimer = () => {
    if (holdTimer.current != null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  const detachTouch = () => {
    if (!nativeTouch.current) return;
    document.removeEventListener("touchmove", nativeTouch.current.move);
    document.removeEventListener("touchend", nativeTouch.current.end);
    document.removeEventListener("touchcancel", nativeTouch.current.cancel);
    nativeTouch.current = null;
  };

  const setJoinFrom = (tableId: number | null) => {
    joinSourceRef.current = tableId;
    setJoinSource(tableId);
    setHoldingId(tableId);
  };

  const updateDragAt = (x: number, y: number) => {
    const current = pointer.current;
    if (!current?.armed) return;
    const dx = x - current.startX;
    const dy = y - current.startY;
    if (!current.dragging && dx * dx + dy * dy < 64) return;
    current.dragging = true;
    setGhost({ number: current.number, x, y });
    const hit = tableFromPoint(x, y);
    const next = hit && hit !== current.tableId ? hit : null;
    overRef.current = next;
    setOverId(next);
  };

  const armDrag = () => {
    const current = pointer.current;
    if (!current || current.armed || current.cancelled) return;
    current.armed = true;
    setJoinFrom(current.tableId);
    setMessage("Toca otra mesa para unirla");
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(12);
    }
  };

  const finishTableGesture = async (table: TableItem, fromCancel = false) => {
    const current = pointer.current;
    const targetId = overRef.current;
    const source = joinSourceRef.current;
    pointer.current = null;
    detachTouch();
    clearHoldTimer();
    overRef.current = null;
    setGhost(null);
    setOverId(null);
    if (fromCancel) return;
    if (!current) {
      if (source != null) {
        if (source === table.id) {
          setJoinFrom(null);
          setMessage("");
          return;
        }
        await joinTables(source, table.id);
        setJoinFrom(null);
      }
      return;
    }
    if (current.cancelled) return;
    if (current.dragging) {
      setJoinFrom(null);
      if (targetId) await joinTables(current.tableId, targetId);
      return;
    }
    if (current.pointerType === "touch" && current.armed) {
      setJoinFrom(current.tableId);
      return;
    }
    if (source != null && source !== table.id) {
      await joinTables(source, table.id);
      setJoinFrom(null);
      return;
    }
    if (source === table.id) {
      setJoinFrom(null);
      setMessage("");
      return;
    }
    await pickTable(table);
  };

  const onTablePointerDown = (event: PointerEvent<HTMLButtonElement>, table: TableItem) => {
    if (event.button !== 0) return;
    clearHoldTimer();
    const needsHold = event.pointerType === "touch";
    pointer.current = {
      tableId: table.id,
      number: table.number,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
      armed: !needsHold,
      cancelled: false,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
    };
    if (!needsHold) return;
    if (joinSourceRef.current == null) {
      holdTimer.current = window.setTimeout(() => armDrag(), TABLE_HOLD_MS);
    }
    detachTouch();
    const move = (touchEvent: TouchEvent) => {
      const current = pointer.current;
      const touch = touchEvent.touches[0];
      if (!current || !touch) return;
      const dx = touch.clientX - current.startX;
      const dy = touch.clientY - current.startY;
      if (!current.armed) {
        if (dx * dx + dy * dy > 64) {
          current.cancelled = true;
          clearHoldTimer();
        }
        return;
      }
      touchEvent.preventDefault();
      updateDragAt(touch.clientX, touch.clientY);
    };
    const end = () => {
      void finishTableGesture(table);
    };
    const cancel = () => {
      const current = pointer.current;
      detachTouch();
      clearHoldTimer();
      setGhost(null);
      setOverId(null);
      if (current && !current.armed) {
        current.cancelled = true;
        pointer.current = null;
      }
    };
    nativeTouch.current = { move, end, cancel };
    document.addEventListener("touchmove", move, { passive: false });
    document.addEventListener("touchend", end);
    document.addEventListener("touchcancel", cancel);
  };

  const onTablePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const current = pointer.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (current.pointerType === "touch") return;
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    if (!current.dragging && dx * dx + dy * dy < 64) return;
    if (!current.dragging) {
      current.dragging = true;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* captura no disponible */
      }
    }
    updateDragAt(event.clientX, event.clientY);
  };

  const onTablePointerCancel = () => {
    const current = pointer.current;
    detachTouch();
    clearHoldTimer();
    setGhost(null);
    setOverId(null);
    if (current?.armed) return;
    pointer.current = null;
  };

  const onTablePointerUp = async (table: TableItem) => {
    if (pointer.current?.pointerType === "touch") return;
    await finishTableGesture(table);
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
          !isSentToKitchen(d)
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
    if (isSentToKitchen(detail)) return;
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
    setDishQuery("");
  };

  const shortageFor = (detail: OrderDetail) => {
    const name = detail.dish ? dishLabel(detail.dish) : "";
    return shortages.filter(
      (s) => s.dishes.includes(name) || s.dishes.includes(detail.dish?.name || "")
    );
  };

  const renderLine = (detail: OrderDetail) => {
    const alerts = shortageFor(detail);
    const sentLine = isSentToKitchen(detail);
    const canChangeQty = canEditItems && !sentLine;
    return (
      <article
        key={detail.id}
        className={`pos-line ${alerts.length ? "warn" : ""} ${
          canChangeQty && !editing ? "pending" : ""
        }`}
      >
        <div className="pos-line-top">
          <div>
            <strong>{detail.dish?.name || `Plato ${detail.dish_id}`}</strong>
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
            {sentLine
              ? ` · ${kitchenStatusLabel(detail.kitchen_status || "pendiente")}`
              : ""}
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
            Stock insuficiente de {alert.name} (solo quedan {alert.available})
          </p>
        ))}
      </article>
    );
  };

  if (!activeOrder) {
    return (
      <div className="pos-page">
        <div className="page-head">
          <div>
            <h1>Toma de pedidos</h1>
            <p>
              Toca una mesa para abrir el pedido. En el celular, deja presionada
              una mesa y luego toca otra para unirlas.
            </p>
          </div>
        </div>
        {error ? <div className="alert alert-error">{error}</div> : null}
        {message ? <div className="alert alert-ok">{message}</div> : null}

        <section className="panel">
          <h2>Mesas</h2>
          <p className="muted table-join-hint">
            Celular o tablet: deja presionada una mesa y toca la otra. En
            computadora puedes arrastrar una sobre otra.
          </p>
          {joinSource != null ? (
            <div className="table-join-banner">
              <span>
                Mesa{" "}
                {String(
                  tables.find((item) => item.id === joinSource)?.number ?? ""
                ).padStart(2, "0")}{" "}
                lista. Toca otra mesa para unirla.
              </span>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setJoinFrom(null);
                  setMessage("");
                }}
              >
                Cancelar
              </button>
            </div>
          ) : null}
          <div
            className={`table-grid${
              ghost || holdingId || joinSource != null ? " joining" : ""
            }`}
          >
            {tables.map((table) => {
              const open = openByTable.get(table.id);
              const state = tableState(open);
              const joined =
                (table.group_numbers?.length || 0) > 1 ||
                (open ? tableNumbers(open).length > 1 : false);
              return (
                <button
                  key={table.id}
                  type="button"
                  data-table-id={table.id}
                  className={`table-tile ${state.className}${
                    joined ? " joined" : ""
                  }${overId === table.id ? " drop-target" : ""}${
                    holdingId === table.id || joinSource === table.id
                      ? " holding"
                      : ""
                  }${
                    ghost && table.number === ghost.number ? " dragging" : ""
                  }`}
                  disabled={busy}
                  onPointerDown={(event) => onTablePointerDown(event, table)}
                  onPointerMove={onTablePointerMove}
                  onPointerUp={() => onTablePointerUp(table)}
                  onPointerCancel={onTablePointerCancel}
                  onContextMenu={(event) => event.preventDefault()}
                >
                  <strong>Mesa {String(table.number).padStart(2, "0")}</strong>
                  <span>
                    {joined
                      ? `Con ${(
                          open
                            ? tableNumbers(open)
                            : table.group_numbers || []
                        )
                          .filter((n) => n !== table.number)
                          .map((n) => String(n).padStart(2, "0"))
                          .join(" + ")} · ${state.label}`
                      : state.label}
                  </span>
                  {open ? <em>{money(open.total)}</em> : null}
                </button>
              );
            })}
          </div>
          {ghost ? (
            <div
              className="table-ghost"
              style={{ left: ghost.x, top: ghost.y }}
            >
              Mesa {String(ghost.number).padStart(2, "0")}
            </div>
          ) : null}
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
              <h1>Toma de pedido — {tablesLabel(activeOrder)}</h1>
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
              <input
                className="pos-search"
                value={dishQuery}
                onChange={(e) => setDishQuery(e.target.value)}
                placeholder="Buscar plato, categoría, precio…"
                aria-label="Buscar plato en la carta"
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
                <div className="empty">
                  {dishQuery.trim()
                    ? "Ningún plato coincide con la búsqueda"
                    : "No hay platos en esta categoría"}
                </div>
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
                {tablesLabel(activeOrder)} · {formatTime(activeOrder.created_at)} ·{" "}
                {activeOrder.waiter?.name || user?.name || "Mesero"}
              </p>
              {tableNumbers(activeOrder).length > 1 ? (
                <div className="table-chips">
                  {(activeOrder.tables || []).map((table) => (
                    <span key={table.id} className="table-chip">
                      Mesa {String(table.number).padStart(2, "0")}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="pos-ticket-head-actions">
              {activeOrder.kitchen_ticket ? (
                <span className="muted">
                  {kitchenStatusLabel(activeOrder.kitchen_ticket.status)}
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
            ) : activeOrder.status === "confirmado" ? (
              <>
                <section className="pos-ticket-group">
                  <h3>Enviado a cocina</h3>
                  {sent.length ? (
                    sent.map(renderLine)
                  ) : (
                    <p className="muted">Todavía no hay platos en cocina.</p>
                  )}
                </section>
                <section className="pos-ticket-group">
                  <h3>Extras</h3>
                  {unsent.length ? (
                    unsent.map(renderLine)
                  ) : (
                    <p className="muted">
                      Si piden más, agrégalos desde la carta. Aparecerán aquí
                      hasta enviarlos a cocina.
                    </p>
                  )}
                </section>
              </>
            ) : (
              details.map(renderLine)
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
              Comanda: {kitchenStatusLabel(activeOrder.kitchen_ticket.status)}
            </p>
          ) : null}
          </aside>
        </div>,
        document.body
      )}
    </div>
  );
}
