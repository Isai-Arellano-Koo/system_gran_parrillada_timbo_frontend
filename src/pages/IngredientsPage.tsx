import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { catalogApi } from "../api/services";
import { ApiError } from "../api/client";
import type { Ingredient } from "../types";

const UNITS = ["kg", "g", "lt", "ml", "unidad"] as const;

export function IngredientsPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<Ingredient[]>([]);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<(typeof UNITS)[number]>("kg");
  const [stockMinimum, setStockMinimum] = useState("0");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const load = async () => {
    if (!token) return;
    setItems(await catalogApi.listIngredients(token));
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
      await catalogApi.createIngredient(token, {
        name,
        unit,
        stock_minimum: Number(stockMinimum) || 0,
      });
      setName("");
      setStockMinimum("0");
      setOk("Ingrediente registrado");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar");
    }
  };

  const toggleActive = async (item: Ingredient) => {
    if (!token) return;
    try {
      await catalogApi.updateIngredient(token, item.id, {
        is_active: !item.is_active,
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo actualizar");
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Ingredientes</h1>
          <p>HU02 — Registrar ingredientes y unidades de medida.</p>
        </div>
      </div>

      <div className="grid-2">
        <section className="panel">
          <h2>Nuevo ingrediente</h2>
          {error ? <div className="alert alert-error">{error}</div> : null}
          {ok ? <div className="alert alert-ok">{ok}</div> : null}
          <form className="form-grid" onSubmit={onSubmit}>
            <label>
              Nombre
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
            <div className="form-row">
              <label>
                Unidad
                <select
                  value={unit}
                  onChange={(e) =>
                    setUnit(e.target.value as (typeof UNITS)[number])
                  }
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Stock mínimo
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={stockMinimum}
                  onChange={(e) => setStockMinimum(e.target.value)}
                />
              </label>
            </div>
            <button className="btn btn-primary" type="submit">
              Guardar
            </button>
          </form>
        </section>

        <section className="panel">
          <h2>Listado</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Unidad</th>
                  <th>Stock</th>
                  <th>Mín.</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.unit}</td>
                    <td>{Number(item.stock_current)}</td>
                    <td>{Number(item.stock_minimum)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => toggleActive(item)}
                      >
                        {item.is_active ? "Desactivar" : "Activar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 ? (
              <div className="empty">Aún no hay ingredientes</div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
