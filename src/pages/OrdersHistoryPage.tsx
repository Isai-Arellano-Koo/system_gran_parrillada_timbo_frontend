import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLiveReload } from "../context/LiveContext";
import { ordersApi } from "../api/services";
import { ApiError } from "../api/client";
import type { AttentionModality, Order } from "../types";
import {
  attentionLabel,
  dishLabel,
  kitchenStatusLabel,
  orderCodeLabel,
  tablesLabel,
} from "../types";
import { formatDateTime } from "../helpers/datetime";
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

export function OrdersHistoryPage() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [query, setQuery] = useState("");
  const [modality, setModality] = useState<ModalityFilter>("all");
  const [selected, setSelected] = useState<Order | null>(null);
  const [error, setError] = useState("");

  const selectedId = useRef<number | undefined>(undefined);
  selectedId.current = selected?.id;
  const modalityRef = useRef(modality);
  modalityRef.current = modality;

  const load = async (keepId?: number) => {
    if (!token) return;
    const filter = modalityRef.current;
    const list = await ordersApi.list(
      token,
      filter === "all" ? undefined : filter
    );
    setOrders(list);
    const id = keepId ?? selectedId.current;
    if (!id) {
      setSelected(null);
      return;
    }
    if (!list.some((order) => order.id === id)) {
      setSelected(null);
      return;
    }
    const detail = await ordersApi.get(token, id).catch(() => null);
    setSelected(detail || list.find((order) => order.id === id) || null);
  };

  useEffect(() => {
    load()
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Error al cargar")
      );
  }, [token, modality]);

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
  const paged = usePagedRows(visible, `${query}|${modality}`);

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
    modality !== "all"
      ? "No se encontraron resultados"
      : query.trim()
        ? "No se encontraron resultados"
        : "Aún no hay pedidos registrados";

  return (
    <div>
      <div className="page-head">
        <div>
          <p className="crumb">Administración › Pedidos</p>
          <h1>Historial de pedidos</h1>
          <p>
            Distingue mesa, delivery y para llevar. Revisa quién atendió cada
            pedido y, si es de salón, la mesa.
          </p>
        </div>
      </div>
      {error ? <div className="alert alert-error">{error}</div> : null}

      <section className="panel">
          <div className="list-head">
            <div>
              <h2>Pedidos</h2>
              <p>
                {visible.length}{" "}
                {visible.length === 1 ? "pedido" : "pedidos"}
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
          <div className="filter-grid">
            <label>
              Buscar
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Orden, mesa, cliente, quien atendió…"
              />
            </label>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
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
                    <td>{formatDateTime(order.created_at)}</td>
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
