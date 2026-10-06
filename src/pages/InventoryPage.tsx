import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { catalogApi, inventoryApi } from "../api/services";
import { ApiError } from "../api/client";
import type { Ingredient, InventoryMovement, StockAlert } from "../types";

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
        <h2>Movimientos</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Ingrediente</th>
                <th>Tipo</th>
                <th>Cantidad</th>
                <th>Motivo</th>
                <th>Usuario</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td>
                    {m.created_at
                      ? new Date(m.created_at).toLocaleString()
                      : "—"}
                  </td>
                  <td>{m.ingredient?.name || m.ingredient_id}</td>
                  <td>
                    <span className="badge badge-edit">{m.type}</span>
                  </td>
                  <td>{Number(m.quantity)}</td>
                  <td>{m.reason || "—"}</td>
                  <td>{m.user?.name || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {movements.length === 0 ? (
            <div className="empty">Sin movimientos aún</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
