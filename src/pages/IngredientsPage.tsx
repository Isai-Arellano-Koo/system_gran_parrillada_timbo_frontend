import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { catalogApi } from "../api/services";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import type { Ingredient } from "../types";
import { matchesQuery } from "../helpers/search";

const UNITS = ["kg", "g", "lt", "ml", "unidad"] as const;
type Unit = (typeof UNITS)[number];

export function IngredientsPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<Ingredient[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<Unit>("kg");
  const [stockMinimum, setStockMinimum] = useState("0");
  const [active, setActive] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");

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
    setStockMinimum("0");
    setActive(true);
  };

  const startEdit = (item: Ingredient) => {
    setError("");
    setOk("");
    setEditingId(item.id);
    setName(item.name);
    setUnit(item.unit);
    setStockMinimum(String(Number(item.stock_minimum)));
    setActive(item.is_active);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError("");
    setOk("");

    setSaving(true);
    try {
      if (editingId) {
        await catalogApi.updateIngredient(token, editingId, {
          name: name.trim(),
          unit,
          stock_minimum: Number(stockMinimum) || 0,
          is_active: active,
        });
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
        setOk("Ingrediente registrado. El stock se carga en Inventario.");
        resetForm();
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const visible = useMemo(
    () =>
      items.filter((item) =>
        matchesQuery(
          query,
          item.name,
          item.unit,
          item.is_active ? "activo" : "inactivo",
          Number(item.stock_current),
          Number(item.stock_minimum),
          Number(item.stock_current) <= Number(item.stock_minimum) ? "alerta bajo mínimo" : ""
        )
      ),
    [items, query]
  );

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
          <p>Alta de insumos y mínimo de alerta. El stock entra por Inventario.</p>
        </div>
        <Link className="btn btn-ghost" to="/inventory">
          Ir a inventario
        </Link>
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
          <div className="list-head">
            <div>
              <h2>Listado</h2>
              <p>
                {visible.length} {visible.length === 1 ? "ingrediente" : "ingredientes"}
              </p>
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, unidad, stock…"
              aria-label="Buscar ingrediente"
            />
          </div>
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
                {visible.map((item) => {
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
            {!visible.length ? (
              <div className="empty">
                {items.length ? "Nada coincide con la búsqueda" : "Aún no hay ingredientes"}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
