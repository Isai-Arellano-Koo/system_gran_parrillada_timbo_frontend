import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { catalogApi, inventoryApi } from "../api/services";
import { ApiError } from "../api/client";
import type { Ingredient, InventoryMovement, StockAlert } from "../types";
import { orderCodeLabel } from "../types";
import { matchesQuery } from "../helpers/search";

const MOVE_TYPES = [
  { value: "", label: "Todos los tipos" },
  { value: "entrada", label: "Entrada" },
  { value: "salida_venta", label: "Salida por venta" },
  { value: "devolucion", label: "Devolución" },
  { value: "ajuste", label: "Ajuste" },
  { value: "merma", label: "Merma" },
] as const;

function typeLabel(type: string) {
  return MOVE_TYPES.find((item) => item.value === type)?.label || type;
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function toDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function movementOrderLabel(item: InventoryMovement) {
  if (item.type !== "salida_venta") return "—";
  if (item.order?.code) {
    const mesa = item.order.table?.number ?? item.order.table_id;
    return mesa
      ? `${orderCodeLabel(item.order)} · Mesa ${String(mesa).padStart(2, "0")}`
      : orderCodeLabel(item.order);
  }
  return item.order_id ? `Pedido #${item.order_id}` : "—";
}

export function InventoryPage() {
  const { token } = useAuth();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [ingredientId, setIngredientId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("Compra / ingreso");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [stockQuery, setStockQuery] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "empty">("all");
  const [moveQuery, setMoveQuery] = useState("");
  const [moveType, setMoveType] = useState("");
  const [moveIngredientId, setMoveIngredientId] = useState("");
  const [moveUserId, setMoveUserId] = useState("");
  const [moveFrom, setMoveFrom] = useState("");
  const [moveTo, setMoveTo] = useState("");

  const load = async () => {
    if (!token) return;
    const [ings, movs, alrts] = await Promise.all([
      catalogApi.listIngredients(token),
      inventoryApi.listMovements(token),
      inventoryApi.listAlerts(token),
    ]);
    setIngredients(ings.filter((i) => i.is_active));
    setMovements(movs);
    setAlerts(alrts);
  };

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof ApiError ? err.message : "Error al cargar")
    );
  }, [token]);

  const visibleStock = useMemo(() => {
    return ingredients.filter((item) => {
      const current = Number(item.stock_current);
      const minimum = Number(item.stock_minimum);
      if (stockFilter === "low" && current > minimum) return false;
      if (stockFilter === "empty" && current > 0) return false;
      return matchesQuery(
        stockQuery,
        item.name,
        item.unit,
        current,
        minimum,
        current <= minimum ? "alerta bajo mínimo" : "",
        current <= 0 ? "sin stock" : ""
      );
    });
  }, [ingredients, stockQuery, stockFilter]);

  const moveUsers = useMemo(() => {
    const map = new Map<number, string>();
    for (const item of movements) {
      if (item.user?.id) map.set(item.user.id, item.user.name);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "es"));
  }, [movements]);

  const visibleMoves = useMemo(() => {
    const from = moveFrom ? new Date(`${moveFrom}T00:00:00`) : null;
    const to = moveTo ? new Date(`${moveTo}T23:59:59.999`) : null;
    return movements.filter((item) => {
      if (moveType && item.type !== moveType) return false;
      if (moveIngredientId && String(item.ingredient_id) !== moveIngredientId) {
        return false;
      }
      if (moveUserId && String(item.user?.id || "") !== moveUserId) return false;
      const created = item.created_at ? new Date(item.created_at) : null;
      if (from && (!created || created < from)) return false;
      if (to && (!created || created > to)) return false;
      const when = created ? created.toLocaleString() : "";
      return matchesQuery(
        moveQuery,
        item.ingredient?.name,
        item.ingredient?.unit,
        item.ingredient_id,
        item.type,
        typeLabel(item.type),
        Number(item.quantity),
        item.reason,
        item.user?.name,
        movementOrderLabel(item),
        when
      );
    });
  }, [
    movements,
    moveQuery,
    moveType,
    moveIngredientId,
    moveUserId,
    moveFrom,
    moveTo,
  ]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError("");
    setOk("");
    try {
      await inventoryApi.createEntry(token, {
        ingredient_id: Number(ingredientId),
        quantity: Number(quantity),
        reason,
      });
      setQuantity("");
      setOk("Entrada registrada y stock actualizado");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar");
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Inventario</h1>
          <p>Registra entradas, revisa los movimientos y las alertas de stock.</p>
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {ok ? <div className="alert alert-ok">{ok}</div> : null}

      <div className="grid-2">
        <section className="panel">
          <h2>Registrar entrada</h2>
          <form className="form-grid" onSubmit={onSubmit}>
            <label>
              Ingrediente
              <select
                value={ingredientId}
                onChange={(e) => setIngredientId(e.target.value)}
                required
              >
                <option value="">Seleccionar...</option>
                {ingredients.map((ing) => (
                  <option key={ing.id} value={ing.id}>
                    {ing.name} — stock {Number(ing.stock_current)} {ing.unit}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Cantidad
              <input
                type="number"
                min="0.001"
                step="0.001"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </label>
            <label>
              Motivo
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </label>
            <button className="btn btn-primary" type="submit">
              Registrar entrada
            </button>
          </form>
        </section>

        <section className="panel">
          <h2>Alertas de stock mínimo</h2>
          {alerts.length === 0 ? (
            <div className="empty">Sin alertas activas</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ingrediente</th>
                    <th>Actual</th>
                    <th>Mínimo</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((a) => (
                    <tr key={a.ingredient_id}>
                      <td>{a.name}</td>
                      <td>
                        {a.stock_current} {a.unit}
                      </td>
                      <td>
                        {a.stock_minimum} {a.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="panel">
        <div className="list-head">
          <div>
            <h2>Stock actual</h2>
            <p>
              {visibleStock.length} {visibleStock.length === 1 ? "insumo" : "insumos"}
            </p>
          </div>
          <input
            value={stockQuery}
            onChange={(e) => setStockQuery(e.target.value)}
            placeholder="Buscar insumo, unidad, cantidad…"
            aria-label="Buscar stock"
          />
        </div>
        <div className="filter-bar">
          <select
            value={stockFilter}
            onChange={(e) =>
              setStockFilter(e.target.value as "all" | "low" | "empty")
            }
            aria-label="Filtrar stock"
          >
            <option value="all">Todo el stock</option>
            <option value="low">Bajo mínimo</option>
            <option value="empty">Sin stock</option>
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ingrediente</th>
                <th>Unidad</th>
                <th>Actual</th>
                <th>Mínimo</th>
              </tr>
            </thead>
            <tbody>
              {visibleStock.map((item) => {
                const low = Number(item.stock_current) <= Number(item.stock_minimum);
                return (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.unit}</td>
                    <td>
                      <span className={low ? "badge badge-warn" : undefined}>
                        {Number(item.stock_current)}
                      </span>
                    </td>
                    <td>{Number(item.stock_minimum)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!visibleStock.length ? (
            <div className="empty">Nada coincide con el filtro</div>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <div className="list-head">
          <div>
            <h2>Movimientos</h2>
            <p>
              {visibleMoves.length}{" "}
              {visibleMoves.length === 1 ? "movimiento" : "movimientos"}
            </p>
          </div>
          <input
            value={moveQuery}
            onChange={(e) => setMoveQuery(e.target.value)}
            placeholder="Buscar insumo, tipo, motivo, usuario, pedido…"
            aria-label="Buscar movimiento"
          />
        </div>
        <div className="filter-bar">
          <select
            value={moveIngredientId}
            onChange={(e) => setMoveIngredientId(e.target.value)}
            aria-label="Filtrar por ingrediente"
          >
            <option value="">Todos los ingredientes</option>
            {ingredients.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            value={moveType}
            onChange={(e) => setMoveType(e.target.value)}
            aria-label="Filtrar por tipo"
          >
            {MOVE_TYPES.map((item) => (
              <option key={item.value || "all"} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <select
            value={moveUserId}
            onChange={(e) => setMoveUserId(e.target.value)}
            aria-label="Filtrar por usuario"
          >
            <option value="">Todos los usuarios</option>
            {moveUsers.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={moveFrom}
            onChange={(e) => setMoveFrom(e.target.value)}
            aria-label="Desde"
          />
          <input
            type="date"
            value={moveTo}
            onChange={(e) => setMoveTo(e.target.value)}
            aria-label="Hasta"
          />
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              const today = toDateInput(startOfToday());
              setMoveFrom(today);
              setMoveTo(today);
            }}
          >
            Hoy
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Ingrediente</th>
                <th>Tipo</th>
                <th>Cantidad</th>
                <th>Pedido</th>
                <th>Descripción</th>
                <th>Usuario</th>
              </tr>
            </thead>
            <tbody>
              {visibleMoves.map((m) => (
                <tr key={m.id}>
                  <td>
                    {m.created_at
                      ? new Date(m.created_at).toLocaleString()
                      : "—"}
                  </td>
                  <td>{m.ingredient?.name || m.ingredient_id}</td>
                  <td>
                    <span className="badge badge-edit">{typeLabel(m.type)}</span>
                  </td>
                  <td>
                    {Number(m.quantity)} {m.ingredient?.unit || ""}
                  </td>
                  <td>{movementOrderLabel(m)}</td>
                  <td>{m.reason || "—"}</td>
                  <td>{m.user?.name || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visibleMoves.length ? (
            <div className="empty">
              {movements.length
                ? "Nada coincide con la búsqueda o los filtros"
                : "Sin movimientos aún"}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
