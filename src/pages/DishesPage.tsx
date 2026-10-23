import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { catalogApi } from "../api/services";
import { ApiError } from "../api/client";
import type { Category, Dish } from "../types";
import { dishLabel } from "../types";
import { DishRecipePage } from "./DishRecipePage";

function hasRecipe(dish: Dish) {
  return (dish.recipe_items || []).length > 0;
}

export function DishesPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const canManage = user?.role === "admin";
  const tab = params.get("tab") === "recetas" ? "recetas" : "fichas";
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryTab, setCategoryTab] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [presentation, setPresentation] = useState("");
  const [categoryId, setCategoryId] = useState("");
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
    const [dishList, categoryList] = await Promise.all([
      catalogApi.listDishes(token),
      catalogApi.listCategories(token, !canManage),
    ]);
    setDishes(dishList);
    setCategories(categoryList.filter((item) => canManage || item.is_active));
  };

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof ApiError ? err.message : "Error al cargar")
    );
  }, [token, canManage]);

  const setTab = (next: "fichas" | "recetas") => {
    const nextParams = new URLSearchParams(params);
    if (next === "fichas") nextParams.delete("tab");
    else nextParams.set("tab", "recetas");
    setParams(nextParams, { replace: true });
  };

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setPresentation("");
    setCategoryId("");
    setPrice("");
    setDescription("");
    setActive(true);
    setOriginalActive(true);
    setFormStatusReason("");
    setShowForm(false);
  };

  const startEdit = (dish: Dish) => {
    setError("");
    setOk("");
    setShowForm(true);
    setEditingId(dish.id);
    setName(dish.name);
    setPresentation(dish.presentation || "");
    setCategoryId(String(dish.category_id || dish.category?.id || ""));
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
    if (!categoryId) {
      setError("Asigna el plato a una categoría existente");
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
          presentation: presentation.trim(),
          category_id: Number(categoryId),
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
          presentation: presentation.trim(),
          category_id: Number(categoryId),
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
          ? `${dishLabel(statusTarget)} volvió a la carta`
          : `${dishLabel(statusTarget)} quedó fuera de la carta`
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

  const visibleCategories = useMemo(
    () => categories.filter((item) => item.is_active),
    [categories]
  );

  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();
    return dishes.filter((dish) => {
      if (!canManage && dish.is_active === false) return false;
      if (categoryTab !== "all" && String(dish.category_id) !== categoryTab) {
        return false;
      }
      if (!text) return true;
      return (
        dish.name.toLowerCase().includes(text) ||
        (dish.presentation || "").toLowerCase().includes(text) ||
        (dish.category?.name || "").toLowerCase().includes(text) ||
        (dish.description || "").toLowerCase().includes(text)
      );
    });
  }, [dishes, query, canManage, categoryTab]);

  const activeCount = dishes.filter((dish) => dish.is_active).length;
  const inactiveCount = dishes.filter((dish) => dish.is_active === false).length;
  const withRecipe = dishes.filter(hasRecipe).length;
  const pendingRecipe = dishes.length - withRecipe;

  if (tab === "recetas" && canManage) {
    return (
      <div>
        <CatalogHeader
          canManage={canManage}
          tab={tab}
          onTab={setTab}
        />
        <DishRecipePage embedded />
      </div>
    );
  }

  return (
    <div>
      <CatalogHeader canManage={canManage} tab={tab} onTab={setTab} />

      {error ? <div className="alert alert-error">{error}</div> : null}
      {ok ? <div className="alert alert-ok">{ok}</div> : null}

      {canManage ? (
        <div className="catalog-cards">
          <article className="panel catalog-card">
            <p className="catalog-card-kicker">Platos y Precios de Venta</p>
            <h2>
              {activeCount} Platos Activos / {inactiveCount} Inactivos
            </h2>
            <p>Registra, edita y activa platos visibles para los meseros.</p>
            <div className="actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowForm(false)}
              >
                Ver lista
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  resetForm();
                  setShowForm(true);
                }}
              >
                Gestionar Platos
              </button>
            </div>
          </article>
          <article className="panel catalog-card">
            <p className="catalog-card-kicker">Asociación de Recetas e Ingredientes</p>
            <h2>
              {withRecipe} Recetas Configuradas / {pendingRecipe} Pendientes
            </h2>
            <p>Configura recetas para el control automático de stock.</p>
            <div className="actions">
              <Link className="btn btn-ghost" to="/dishes/recetas">
                Ver lista
              </Link>
              <Link className="btn btn-primary" to="/dishes/recetas">
                Gestionar Recetas
              </Link>
            </div>
          </article>
        </div>
      ) : null}

      {showForm && canManage ? (
        <section className="panel">
          <h2>{editingId ? "Editar plato" : "Registro de Plato"}</h2>
          <form className="form-grid" onSubmit={save}>
            <div className="form-row">
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
                Presentación
                <input
                  value={presentation}
                  onChange={(e) => setPresentation(e.target.value)}
                  placeholder="Ej. Porción, 300 g, Botella"
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Categoría
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  required
                >
                  <option value="">Selecciona una categoría</option>
                  {categories
                    .filter((item) => item.is_active || String(item.id) === categoryId)
                    .map((item) => (
                      <option key={item.id} value={item.id} disabled={!item.is_active}>
                        {item.name}
                        {item.is_active ? "" : " (quitada)"}
                      </option>
                    ))}
                </select>
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
            </div>
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
                />
              </label>
            ) : null}
            <div className="form-footer">
              <button type="button" className="btn btn-ghost" onClick={resetForm}>
                Cancelar
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

      <div className="category-tabs" role="tablist" aria-label="Categorías de la carta">
        <button
          type="button"
          role="tab"
          aria-selected={categoryTab === "all"}
          className={`category-tab${categoryTab === "all" ? " active" : ""}`}
          onClick={() => setCategoryTab("all")}
        >
          Todas
        </button>
        {visibleCategories.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={categoryTab === String(item.id)}
            className={`category-tab${categoryTab === String(item.id) ? " active" : ""}`}
            onClick={() => setCategoryTab(String(item.id))}
          >
            {item.name}
          </button>
        ))}
      </div>

      <section className="panel">
        <div className="list-head">
          <div>
            <h2>
              {categoryTab === "all"
                ? "Últimos platos creados"
                : visibleCategories.find((item) => String(item.id) === categoryTab)?.name ||
                  "Platos"}
            </h2>
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
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((dish) => (
                <tr key={dish.id}>
                  <td>
                    <strong>{dishLabel(dish)}</strong>
                    <div className="hint">{dish.category?.name || "Sin categoría"}</div>
                  </td>
                  <td>S/ {Number(dish.price).toFixed(2)}</td>
                  <td>
                    <span
                      className={`badge ${dish.is_active ? "badge-ok" : "badge-danger"}`}
                    >
                      {dish.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td>
                    {canManage ? (
                      <div className="actions">
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => startEdit(dish)}
                        >
                          Editar
                        </button>
                        <Link
                          className="btn btn-ghost"
                          to={`/dishes/${dish.id}/receta`}
                        >
                          {hasRecipe(dish) ? "Editar receta" : "Crear receta"}
                        </Link>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => openStatusDialog(dish)}
                        >
                          Estado
                        </button>
                      </div>
                    ) : (
                      <span className="hint">
                        {hasRecipe(dish) ? "Con receta" : "Sin receta"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 ? (
            <div className="empty">No hay platos en esta categoría</div>
          ) : null}
        </div>
        <div className="list-foot">
          <span>
            Mostrando {visible.length} de {canManage ? dishes.length : visible.length}{" "}
            {dishes.length === 1 ? "plato" : "platos"}
          </span>
          {canManage ? (
            <span>
              {pendingRecipe === 1
                ? "1 receta por configurar"
                : `${pendingRecipe} recetas por configurar`}
            </span>
          ) : null}
        </div>
      </section>

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
                ? `Reactivar ${dishLabel(statusTarget)}`
                : `Sacar ${dishLabel(statusTarget)} de la carta`}
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

function CatalogHeader({
  canManage,
  tab,
  onTab,
}: {
  canManage: boolean;
  tab: "fichas" | "recetas";
  onTab: (tab: "fichas" | "recetas") => void;
}) {
  return (
    <div className="page-head catalog-head">
      <div>
        <p className="crumb">Administración › Carta</p>
        <h1>Gestión de Carta y Menú</h1>
        <p>
          {canManage
            ? "Administra los platos del restaurante y configura las recetas de cocina para el control automático de stock."
            : "Carta activa por categoría, con precios de venta."}
        </p>
        {canManage ? (
          <div className="page-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "fichas"}
              className={`page-tab${tab === "fichas" ? " active" : ""}`}
              onClick={() => onTab("fichas")}
            >
              Fichas
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "recetas"}
              className={`page-tab${tab === "recetas" ? " active" : ""}`}
              onClick={() => onTab("recetas")}
            >
              Recetas
            </button>
          </div>
        ) : null}
      </div>
      {canManage ? (
        <Link className="btn btn-ghost" to="/categories">
          Categorías
        </Link>
      ) : null}
    </div>
  );
}
