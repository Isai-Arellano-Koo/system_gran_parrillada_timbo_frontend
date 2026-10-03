import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { catalogApi, inventoryApi } from "../api/services";
import { ApiError } from "../api/client";
import type { Ingredient } from "../types";

const UNITS = ["kg", "g", "lt", "ml", "unidad"] as const;
type Unit = (typeof UNITS)[number];

export function IngredientsPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<Ingredient[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<Unit>("kg");
  const [stockCurrent, setStockCurrent] = useState("0");
  const [stockMinimum, setStockMinimum] = useState("0");
  const [active, setActive] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!token) return;
    setItems(await catalogApi.listIngredients(token));
  };

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof ApiError ? err.message : "Error al cargar")
    );
  }, [token]);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setUnit("kg");
    setStockCurrent("0");
    setStockMinimum("0");
    setActive(true);
  };

  const startEdit = (item: Ingredient) => {
    setError("");
    setOk("");
    setEditingId(item.id);
    setName(item.name);
    setUnit(item.unit);
    setStockCurrent(String(Number(item.stock_current)));
    setStockMinimum(String(Number(item.stock_minimum)));
    setActive(item.is_active);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError("");
    setOk("");

    const nextStock = Number(stockCurrent);
    if (!Number.isFinite(nextStock) || nextStock < 0) {
      setError("El stock no puede ser negativo");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const current = items.find((item) => item.id === editingId);
        await catalogApi.updateIngredient(token, editingId, {
          name: name.trim(),
          unit,
          stock_minimum: Number(stockMinimum) || 0,
          is_active: active,
        });
        if (!current || Number(current.stock_current) !== nextStock) {
          await inventoryApi.adjustStock(token, {
            ingredient_id: editingId,
            stock_current: nextStock,
            reason: "Ajuste manual de stock",
          });
        }
        setOk("Ingrediente actualizado");
      } else {
        const created = await catalogApi.createIngredient(token, {
          name: name.trim(),
          unit,
          stock_minimum: Number(stockMinimum) || 0,
        });
        if (!active) {
          await catalogApi.updateIngredient(token, created.id, { is_active: false });
        }
        if (nextStock > 0) {
          await inventoryApi.adjustStock(token, {
            ingredient_id: created.id,
            stock_current: nextStock,
            reason: "Stock inicial",
          });
        }
        setOk("Ingrediente registrado");
        resetForm();
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item: Ingredient) => {
    if (!token) return;
    setError("");
    setOk("");
    try {
      await catalogApi.updateIngredient(token, item.id, {
        is_active: !item.is_active,
      });
      if (editingId === item.id) setActive(!item.is_active);
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
          <p>Edita cada insumo y corrige su stock actual o el mínimo de alerta.</p>
        </div>
        {editingId ? (
          <button type="button" className="btn btn-ghost" onClick={resetForm}>
            Nuevo ingrediente
          </button>
        ) : null}
      </div>

      <div className="grid-2">
        <section className="panel">
          <h2>{editingId ? "Editar ingrediente" : "Nuevo ingrediente"}</h2>
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
                  onChange={(e) => setUnit(e.target.value as Unit)}
                >
                  {UNITS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Stock actual
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={stockCurrent}
                  onChange={(e) => setStockCurrent(e.target.value)}
                  required
                />
              </label>
            </div>
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
            <label className={`switch${active ? " on" : ""}`}>
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              <span className="switch-ui" />
              <span className="switch-label">
                {active ? "Activo" : "Inactivo"}
              </span>
            </label>
            <div className="form-footer">
              {editingId ? (
                <button type="button" className="btn btn-ghost" onClick={resetForm}>
                  Cancelar
                </button>
              ) : null}
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving
                  ? "Guardando..."
                  : editingId
                    ? "Guardar cambios"
                    : "Guardar"}
              </button>
            </div>
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
                {items.map((item) => {
                  const low =
                    item.is_active &&
                    Number(item.stock_current) <= Number(item.stock_minimum);
                  return (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.name}</strong>
                        {!item.is_active ? (
                          <div className="hint">Inactivo</div>
                        ) : null}
                      </td>
                      <td>{item.unit}</td>
                      <td>
                        <span className={low ? "badge badge-warn" : undefined}>
                          {Number(item.stock_current)}
                        </span>
                      </td>
                      <td>{Number(item.stock_minimum)}</td>
                      <td>
                        <div className="actions">
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => startEdit(item)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => toggleActive(item)}
                          >
                            {item.is_active ? "Desactivar" : "Activar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
