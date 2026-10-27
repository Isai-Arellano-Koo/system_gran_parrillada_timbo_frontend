import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { catalogApi } from "../api/services";
import { ApiError } from "../api/client";
import type { Category } from "../types";
import { dishLabel } from "../types";

export function CategoriesPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [saving, setSaving] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Category | null>(null);

  const load = async () => {
    if (!token) return;
    setItems(await catalogApi.listCategories(token));
  };

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof ApiError ? err.message : "Error al cargar")
    );
  }, [token]);

  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();
    return items.filter(
      (item) => !text || item.name.toLowerCase().includes(text)
    );
  }, [items, query]);

  const addCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError("");
    setOk("");
    if (!name.trim()) {
      setError("El nombre de la categoría es obligatorio");
      return;
    }
    setSaving(true);
    try {
      const created = await catalogApi.createCategory(token, {
        name: name.trim(),
      });
      setOk(
        created.is_active
          ? `${created.name} quedó en la carta`
          : `${created.name} registrada`
      );
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const restoreCategory = async (category: Category) => {
    if (!token) return;
    setError("");
    setOk("");
    setSaving(true);
    try {
      await catalogApi.updateCategory(token, category.id, { is_active: true });
      setOk(
        `${category.name} volvió a la carta. Los platos que se inhabilitaron al quitarla quedan disponibles de nuevo.`
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo restaurar");
    } finally {
      setSaving(false);
    }
  };

  const confirmRemove = async () => {
    if (!token || !removeTarget) return;
    setSaving(true);
    setError("");
    try {
      await catalogApi.removeCategory(token, removeTarget.id);
      setOk(
        `${removeTarget.name} se quitó. Los platos de esa categoría quedan inhabilitados hasta que se vuelva a agregar.`
      );
      setRemoveTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo quitar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <p className="crumb">Administración › Carta › Categorías</p>
          <h1>Categorías</h1>
          <p>
            Cada plato debe pertenecer a una categoría existente. Si quitas una,
            sus platos quedan fuera de la carta hasta que la vuelvas a agregar.
          </p>
        </div>
        <div className="actions">
          <Link className="btn btn-ghost" to="/dishes">
            Ver platos
          </Link>
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {ok ? <div className="alert alert-ok">{ok}</div> : null}

      <div className="grid-2">
        <section className="panel">
          <h2>Agregar categoría</h2>
          <p className="page-lead">
            Si el nombre ya existía y estaba quitado, se reactiva y se habilitan
            otra vez sus platos.
          </p>
          <form className="form-grid" onSubmit={addCategory}>
            <label>
              Nombre
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Parrillas"
                required
              />
            </label>
            <div className="form-footer">
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? "Guardando..." : "Agregar"}
              </button>
            </div>
          </form>
        </section>

        <section className="panel">
          <div className="list-head">
            <div>
              <h2>Lista de categorías</h2>
              <p>
                {visible.length}{" "}
                {visible.length === 1 ? "categoría" : "categorías"}
              </p>
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar categoría..."
              aria-label="Buscar categoría"
            />
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Categoría</th>
                  <th>Platos</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => {
                  const dishCount = item.dishes?.length || 0;
                  return (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.name}</strong>
                      </td>
                      <td>{dishCount}</td>
                      <td>
                        <span
                          className={`badge ${item.is_active ? "badge-ok" : "badge-danger"}`}
                        >
                          {item.is_active ? "En carta" : "Quitada"}
                        </span>
                      </td>
                      <td>
                        {item.is_active ? (
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => setRemoveTarget(item)}
                          >
                            Quitar
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={saving}
                            onClick={() => restoreCategory(item)}
                          >
                            Volver a agregar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {visible.length === 0 ? (
              <div className="empty">Aún no hay categorías</div>
            ) : null}
          </div>
        </section>
      </div>

      {removeTarget ? (
        <div
          className="dialog-backdrop"
          role="presentation"
          onClick={() => setRemoveTarget(null)}
        >
          <div
            className="dialog panel"
            role="dialog"
            aria-labelledby="category-remove-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="category-remove-title">Quitar {removeTarget.name}</h2>
            <p className="page-lead">
              Los platos asignados a esta categoría quedarán inhabilitados hasta
              que se vuelva a agregar la categoría.
            </p>
            {(removeTarget.dishes || []).length > 0 ? (
              <p className="hint">
                Afecta a {(removeTarget.dishes || []).length}{" "}
                {(removeTarget.dishes || []).length === 1 ? "plato" : "platos"}
                :{" "}
                {(removeTarget.dishes || [])
                  .slice(0, 8)
                  .map((dish) => dishLabel(dish))
                  .join(", ")}
                {(removeTarget.dishes || []).length > 8 ? "…" : ""}
              </p>
            ) : (
              <p className="hint">Esta categoría no tiene platos asignados.</p>
            )}
            <div className="form-footer">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setRemoveTarget(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={saving}
                onClick={confirmRemove}
              >
                {saving ? "Quitando..." : "Quitar categoría"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
