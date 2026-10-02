import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { catalogApi, ordersApi } from "../api/services";
import { ApiError } from "../api/client";
import type { Dish, Order, TableItem } from "../types";

function statusClass(status: Order["status"]) {
  if (status === "en_edicion") return "badge-edit";
  if (status === "confirmado") return "badge-ok";
  return "badge-danger";
}

export function OrdersPage() {
  const { token } = useAuth();
  const [tables, setTables] = useState<TableItem[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [tableId, setTableId] = useState("");
  const [dishId, setDishId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [observation, setObservation] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    if (!token) return;
    const [tableList, dishList, orderList] = await Promise.all([
      ordersApi.listTables(token),
      catalogApi.listDishes(token, true),
      ordersApi.list(token),
    ]);
    setTables(tableList);
    setDishes(dishList.filter((d) => d.is_active));
    setOrders(orderList);
    if (activeOrder) {
      const refreshed = orderList.find((o) => o.id === activeOrder.id) || null;
      setActiveOrder(refreshed);
    }
  };

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof ApiError ? err.message : "Error al cargar")
    );
  }, [token]);

  const openOrder = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError("");
    setMessage("");
    try {
      const order = await ordersApi.open(token, Number(tableId));
      setActiveOrder(order);
      setMessage(`Pedido ${order.code} abierto en edición`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo abrir el pedido");
    }
  };

  const addDetail = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !activeOrder) return;
    setError("");
    setMessage("");
    try {
      const order = await ordersApi.addDetail(token, activeOrder.id, {
        dish_id: Number(dishId),
        quantity: Number(quantity),
        observation: observation || undefined,
      });
      setActiveOrder(order);
      setDishId("");
      setQuantity("1");
      setObservation("");
      setMessage("Plato agregado");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo agregar");
    }
  };

  const removeDetail = async (detailId: number) => {
    if (!token || !activeOrder) return;
    try {
      const order = await ordersApi.removeDetail(token, activeOrder.id, detailId);
      setActiveOrder(order);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo eliminar");
    }
  };

  const validateStock = async () => {
    if (!token || !activeOrder) return;
    setError("");
    setMessage("");
    try {
      const result = await ordersApi.validateStock(token, activeOrder.id);
      if (result.ok) {
        setMessage("Stock suficiente para confirmar el pedido");
      } else {
        setError(
          result.shortages
            .map(
              (s) =>
                `${s.name}: necesita ${s.needed}, hay ${s.available} (platos: ${s.dishes.join(", ")})`
            )
            .join(" | ")
        );
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al validar");
    }
  };

  const confirmOrder = async () => {
    if (!token || !activeOrder) return;
    setError("");
    setMessage("");
    try {
      const order = await ordersApi.confirm(token, activeOrder.id);
      setActiveOrder(order);
      setMessage("Pedido confirmado: comanda enviada e inventario descontado");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo confirmar");
    }
  };

  const cancelOrder = async () => {
    if (!token || !activeOrder) return;
    setError("");
    setMessage("");
    try {
      const order = await ordersApi.cancel(token, activeOrder.id, cancelReason);
      setActiveOrder(order);
      setCancelReason("");
      setMessage("Pedido cancelado");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cancelar");
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Pedidos</h1>
          <p>HU06–HU09 / HU13 — Abrir, armar, validar, confirmar o cancelar.</p>
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {message ? <div className="alert alert-ok">{message}</div> : null}

      <div className="grid-2">
        <section className="panel">
          <h2>Abrir pedido</h2>
          <form className="form-grid" onSubmit={openOrder}>
            <label>
              Mesa
              <select
                value={tableId}
                onChange={(e) => setTableId(e.target.value)}
                required
              >
                <option value="">Seleccionar...</option>
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    Mesa {t.number}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn btn-primary" type="submit">
              Abrir pedido
            </button>
          </form>

          <h2 style={{ marginTop: "1.4rem" }}>Pedidos recientes</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Mesa</th>
                  <th>Estado</th>
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 12).map((order) => (
                  <tr key={order.id}>
                    <td>{order.code}</td>
                    <td>{order.table?.number ?? order.table_id}</td>
                    <td>
                      <span className={`badge ${statusClass(order.status)}`}>
                        {order.status.replace("_", " ")}
                      </span>
                    </td>
                    <td>S/ {Number(order.total).toFixed(2)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => setActiveOrder(order)}
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <h2>
            {activeOrder
              ? `Pedido ${activeOrder.code}`
              : "Selecciona o abre un pedido"}
          </h2>

          {!activeOrder ? (
            <div className="empty">Sin pedido seleccionado</div>
          ) : (
            <div className="stack">
              <div className="actions">
                <span className={`badge ${statusClass(activeOrder.status)}`}>
                  {activeOrder.status.replace("_", " ")}
                </span>
                <span className="muted">
                  Mesa {activeOrder.table?.number ?? activeOrder.table_id} · Total
                  S/ {Number(activeOrder.total).toFixed(2)}
                </span>
              </div>

              {activeOrder.status === "en_edicion" && (
                <form className="form-grid" onSubmit={addDetail}>
                  <label>
                    Plato
                    <select
                      value={dishId}
                      onChange={(e) => setDishId(e.target.value)}
                      required
                    >
                      <option value="">Seleccionar...</option>
                      {dishes.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} — S/ {Number(d.price).toFixed(2)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="form-row">
                    <label>
                      Cantidad
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        required
                      />
                    </label>
                    <label>
                      Observación
                      <input
                        value={observation}
                        onChange={(e) => setObservation(e.target.value)}
                        placeholder="Término, sin salsa..."
                      />
                    </label>
                  </div>
                  <button className="btn btn-primary" type="submit">
                    Agregar plato
                  </button>
                </form>
              )}

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Plato</th>
                      <th>Cant.</th>
                      <th>Obs.</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(activeOrder.details || []).map((d) => (
                      <tr key={d.id}>
                        <td>{d.dish?.name || d.dish_id}</td>
                        <td>{d.quantity}</td>
                        <td>{d.observation || "—"}</td>
                        <td>
                          {activeOrder.status === "en_edicion" ? (
                            <button
                              type="button"
                              className="btn btn-danger"
                              onClick={() => removeDetail(d.id)}
                            >
                              Quitar
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {activeOrder.status === "en_edicion" && (
                <div className="actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={validateStock}
                  >
                    Validar stock
                  </button>
                  <button
                    type="button"
                    className="btn btn-ok"
                    onClick={confirmOrder}
                  >
                    Confirmar pedido
                  </button>
                </div>
              )}

              {activeOrder.status !== "cancelado" && (
                <div className="form-row">
                  <label>
                    Motivo de cancelación
                    <input
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="Obligatorio para cancelar"
                    />
                  </label>
                  <div style={{ alignSelf: "end" }}>
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={cancelOrder}
                    >
                      Cancelar pedido
                    </button>
                  </div>
                </div>
              )}

              {activeOrder.kitchen_ticket ? (
                <p className="muted">
                  Comanda: {activeOrder.kitchen_ticket.status.replace("_", " ")}
                </p>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
