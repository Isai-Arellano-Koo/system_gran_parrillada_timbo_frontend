import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { catalogApi } from "../api/services";
import { ApiError } from "../api/client";
import type { Dish } from "../types";

function recipeLabel(dish: Dish) {
  const items = dish.recipe_items || [];
  if (!items.length) return "Sin receta";
  return items
    .map(
      (item) =>
        `${item.ingredient?.name || item.ingredient_id} (${Number(item.quantity)} ${item.ingredient?.unit || ""})`
    )
    .join(", ");
}

export function DishesPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const canManage = user?.role === "admin";
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [originalActive, setOriginalActive] = useState(true);
  const [formStatusReason, setFormStatusReason] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusTarget, setStatusTarget] = useState<Dish | null>(null);
  const [statusReason, setStatusReason] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);

  const load = async () => {
    if (!token) return;
    setDishes(await catalogApi.listDishes(token));
  };

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof ApiError ? err.message : "Error al cargar")
    );
  }, [token, canManage]);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setPrice("");
    setDescription("");
    setActive(true);
    setOriginalActive(true);
    setFormStatusReason("");
  };

  const startEdit = (dish: Dish) => {
    setError("");
    setOk("");
    setEditingId(dish.id);
    setName(dish.name);
    setPrice(String(Number(dish.price)));
    setDescription(dish.description || "");
    setActive(dish.is_active);
    setOriginalActive(dish.is_active);
    setFormStatusReason("");
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !canManage) return;
    setError("");
    setOk("");

    if (!name.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    const nextPrice = Number(price);
    if (!nextPrice || nextPrice <= 0) {
      setError("El precio debe ser mayor que cero");
      return;
    }

    if (editingId && active !== originalActive && formStatusReason.trim().length < 3) {
      setError("Indica el motivo del cambio de estado");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await catalogApi.updateDish(token, editingId, {
          name: name.trim(),
          price: nextPrice,
          description: description.trim(),
          is_active: active,
          ...(active !== originalActive
            ? { status_reason: formStatusReason.trim() }
            : {}),
        });
        setOk("Plato actualizado");
        setOriginalActive(active);
        setFormStatusReason("");
        await load();
      } else {
        const created = await catalogApi.createDish(token, {
          name: name.trim(),
          price: nextPrice,
          description: description.trim(),
          is_active: active,
        });
        navigate(`/dishes/${created.id}/receta`);
        return;
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const openStatusDialog = (dish: Dish) => {
    setError("");
    setOk("");
    setStatusTarget(dish);
    setStatusReason("");
  };

  const confirmStatusChange = async () => {
    if (!token || !statusTarget) return;
    const reason = statusReason.trim();
    if (reason.length < 3) {
      setError("Indica el motivo del cambio de estado");
      return;
    }
    setSavingStatus(true);
    try {
      const is_active = statusTarget.is_active === false;
      await catalogApi.updateDish(token, statusTarget.id, {
        is_active,
        status_reason: reason,
      });
      if (editingId === statusTarget.id) {
        setActive(is_active);
        setOriginalActive(is_active);
        setFormStatusReason("");
      }
      setOk(
        is_active
          ? `${statusTarget.name} volvió a la carta`
          : `${statusTarget.name} quedó fuera de la carta`
      );
      setStatusTarget(null);
      setStatusReason("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo actualizar");
    } finally {
      setSavingStatus(false);
    }
  };

  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();
    return dishes.filter((dish) => {
      if (!canManage && dish.is_active === false) return false;
      if (!text) return true;
      const recipe = recipeLabel(dish).toLowerCase();
      return (
        dish.name.toLowerCase().includes(text) ||
        (dish.description || "").toLowerCase().includes(text) ||
        recipe.includes(text)
      );
    });
  }, [dishes, query, canManage]);

  const inactive = dishes.filter((dish) => dish.is_active === false).length;

  return (
    <div>
      <div className="page-head">
        <div>
          <p className="crumb">Administración › Carta › Platos</p>
          <h1>Gestión de Platos</h1>
          <p>
            {canManage
              ? "Administra los platos de la carta, sus precios, recetas y disponibilidad para los meseros."
              : "Carta activa: precios y receta de cada plato."}
          </p>
        </div>
        {canManage ? (
          <div className="actions">
            <Link className="btn btn-ghost" to="/dishes/recetas">
              Recetas
            </Link>
            <button type="button" className="btn btn-primary" onClick={resetForm}>
              + Nuevo Plato
            </button>
          </div>
        ) : null}
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {ok ? <div className="alert alert-ok">{ok}</div> : null}

      <div className={canManage ? "grid-2" : undefined}>
        {canManage ? (
          <section className="panel">
            <h2>{editingId ? "Editar plato" : "Registro de Plato"}</h2>
            <p className="page-lead">
              {editingId
                ? "Actualiza nombre, precio y disponibilidad. La receta se edita al abrir el plato."
                : "Completa el plato. Después se abre la receta para asociar ingredientes."}
            </p>
            <form className="form-grid" onSubmit={save}>
              <label>
                Nombre del plato
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Parrillada Mixta"
                  required
                />
              </label>
              <label>
                Precio (S/)
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Mayor a 0.00"
                  required
                />
              </label>
              <label>
                Descripción
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>

              <div className="status-row">
                <div>
                  <strong>Estado</strong>
                  <p>Activo: el mesero lo ve. Inactivo: queda fuera de la carta.</p>
                </div>
                <label className={`switch${active ? " on" : ""}`}>
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                  />
                  <span className="switch-ui" />
                  <span className="switch-label">{active ? "Activo" : "Inactivo"}</span>
                </label>
              </div>

              {editingId && active !== originalActive ? (
                <label className="field">
                  <span>Motivo del cambio de estado</span>
                  <textarea
                    value={formStatusReason}
                    onChange={(e) => setFormStatusReason(e.target.value)}
                    rows={3}
                    required
                    placeholder="Ej. Fuera de temporada, se acabó el insumo, vuelve a la carta..."
                  />
                </label>
              ) : null}

              <div className="form-footer">
                <button type="button" className="btn btn-ghost" onClick={resetForm}>
                  Limpiar
                </button>
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {saving
                    ? "Guardando..."
                    : editingId
                      ? "Guardar cambios"
                      : "Guardar Plato"}
                </button>
              </div>
            </form>
          </section>
        ) : null}

        <section className="panel">
          <div className="list-head">
            <div>
              <h2>Lista de Platos</h2>
              <p>
                {visible.length} {visible.length === 1 ? "plato" : "platos"}
              </p>
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar plato..."
              aria-label="Buscar plato"
            />
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Plato</th>
                  <th>Precio</th>
                  <th>Receta</th>
                  <th>Estado</th>
                  {canManage ? <th>Acciones</th> : null}
                </tr>
              </thead>
              <tbody>
                {visible.map((dish) => (
                  <tr key={dish.id}>
                    <td>
                      {canManage ? (
                        <Link to={`/dishes/${dish.id}/receta`}>
                          <strong>{dish.name}</strong>
                        </Link>
                      ) : (
                        <strong>{dish.name}</strong>
                      )}
                      {dish.description ? (
                        <div className="hint">{dish.description}</div>
                      ) : null}
                    </td>
                    <td>S/ {Number(dish.price).toFixed(2)}</td>
                    <td>{recipeLabel(dish)}</td>
                    <td>
                      <span
                        className={`badge ${dish.is_active ? "badge-ok" : "badge-danger"}`}
                      >
                        {dish.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    {canManage ? (
                      <td>
                        <div className="actions">
                          <button
                            type="button"
                            className="icon-link"
                            onClick={() => startEdit(dish)}
                            aria-label={`Editar ${dish.name}`}
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => openStatusDialog(dish)}
                          >
                            Cambiar estado
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
            {visible.length === 0 ? (
              <div className="empty">Aún no hay platos en la carta</div>
            ) : null}
          </div>
          <div className="list-foot">
            <span>
              Mostrando {visible.length} de {canManage ? dishes.length : visible.length}{" "}
              {dishes.length === 1 ? "plato" : "platos"}
            </span>
            {canManage ? (
              <span>
                {inactive === 1 ? "1 plato inactivo" : `${inactive} platos inactivos`}
              </span>
            ) : null}
          </div>
        </section>
      </div>

      {statusTarget ? (
        <div
          className="dialog-backdrop"
          role="presentation"
          onClick={() => setStatusTarget(null)}
        >
          <div
            className="dialog panel"
            role="dialog"
            aria-labelledby="dish-status-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="dish-status-dialog-title">
              {statusTarget.is_active === false
                ? `Reactivar ${statusTarget.name}`
                : `Sacar ${statusTarget.name} de la carta`}
            </h2>
            <p className="page-lead">
              El motivo queda guardado con la fecha y quién hizo el cambio.
            </p>
            {error ? <div className="alert alert-error">{error}</div> : null}
            <label className="field">
              <span>Motivo</span>
              <textarea
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                rows={3}
                required
                placeholder="Ej. Fuera de temporada, se acabó el insumo, vuelve a la carta..."
              />
            </label>
            <div className="form-footer">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setStatusTarget(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={savingStatus}
                onClick={confirmStatusChange}
              >
                {savingStatus ? "Guardando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
