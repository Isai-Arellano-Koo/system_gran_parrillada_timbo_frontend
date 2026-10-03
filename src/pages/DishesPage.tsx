import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { catalogApi } from "../api/services";
import { ApiError } from "../api/client";
import type { Dish, Ingredient } from "../types";

type RecipeRow = { ingredient_id: string; quantity: string };

const emptyRow = (): RecipeRow => ({ ingredient_id: "", quantity: "" });

function rowsFromDish(dish: Dish): RecipeRow[] {
  const rows = (dish.recipe_items || []).map((item) => ({
    ingredient_id: String(item.ingredient_id),
    quantity: String(item.quantity),
  }));
  return rows.length ? rows : [emptyRow()];
}

export function DishesPage() {
  const { token } = useAuth();
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [recipeRows, setRecipeRows] = useState<RecipeRow[]>([emptyRow()]);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!token) return;
    const [dishList, ingredientList] = await Promise.all([
      catalogApi.listDishes(token),
      catalogApi.listIngredients(token),
    ]);
    setDishes(dishList);
    setIngredients(ingredientList);
  };

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof ApiError ? err.message : "Error al cargar")
    );
  }, [token]);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setPrice("");
    setDescription("");
    setActive(true);
    setRecipeRows([emptyRow()]);
  };

  const startEdit = (dish: Dish) => {
    setError("");
    setOk("");
    setEditingId(dish.id);
    setName(dish.name);
    setPrice(String(Number(dish.price)));
    setDescription(dish.description || "");
    setActive(dish.is_active);
    setRecipeRows(rowsFromDish(dish));
  };

  const updateRow = (index: number, patch: Partial<RecipeRow>) => {
    setRecipeRows((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError("");
    setOk("");

    const filled = recipeRows.filter((row) => row.ingredient_id || row.quantity);
    const incomplete = filled.some((row) => !row.ingredient_id || !row.quantity);
    if (incomplete) {
      setError("Cada línea de la receta necesita ingrediente y cantidad");
      return;
    }

    const items = filled.map((row) => ({
      ingredient_id: Number(row.ingredient_id),
      quantity: Number(row.quantity),
    }));
    const ids = items.map((item) => item.ingredient_id);
    if (new Set(ids).size !== ids.length) {
      setError("No se puede repetir un ingrediente en la misma receta");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await catalogApi.updateDish(token, editingId, {
          name: name.trim(),
          price: Number(price),
          description: description.trim(),
          is_active: active,
        });
        await catalogApi.setRecipe(token, editingId, items);
        setOk("Plato y receta actualizados");
      } else {
        const created = await catalogApi.createDish(token, {
          name: name.trim(),
          price: Number(price),
          description: description.trim(),
        });
        if (!active) {
          await catalogApi.updateDish(token, created.id, { is_active: false });
        }
        if (items.length) {
          await catalogApi.setRecipe(token, created.id, items);
        }
        setOk("Plato registrado");
        resetForm();
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const toggleDish = async (dish: Dish) => {
    if (!token) return;
    setError("");
    setOk("");
    try {
      await catalogApi.updateDish(token, dish.id, { is_active: !dish.is_active });
      if (editingId === dish.id) setActive(!dish.is_active);
      setOk(dish.is_active ? "Plato desactivado" : "Plato activado");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo actualizar");
    }
  };

  const ingredientChoices = (selectedId: string) =>
    ingredients.filter(
      (item) => item.is_active || String(item.id) === selectedId
    );

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Carta</h1>
          <p>Edita cada plato y asocia o cambia los ingredientes de su receta.</p>
        </div>
        {editingId ? (
          <button type="button" className="btn btn-ghost" onClick={resetForm}>
            Nuevo plato
          </button>
        ) : null}
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {ok ? <div className="alert alert-ok">{ok}</div> : null}

      <section className="panel">
        <h2>{editingId ? "Editar plato" : "Nuevo plato"}</h2>
        <form className="form-grid" onSubmit={save}>
          <div className="form-row">
            <label>
              Nombre
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
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
              <strong>Receta</strong>
              <p>Ingredientes que se descuentan del inventario al confirmar el pedido.</p>
            </div>
          </div>

          {recipeRows.map((row, index) => (
            <div className="recipe-row" key={index}>
              <label>
                Ingrediente
                <select
                  value={row.ingredient_id}
                  onChange={(e) =>
                    updateRow(index, { ingredient_id: e.target.value })
                  }
                >
                  <option value="">Seleccionar...</option>
                  {ingredientChoices(row.ingredient_id).map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.name} ({ing.unit})
                      {ing.is_active ? "" : " · inactivo"}
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
                  value={row.quantity}
                  onChange={(e) => updateRow(index, { quantity: e.target.value })}
                  placeholder="0.000"
                />
              </label>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() =>
                  setRecipeRows((rows) =>
                    rows.length === 1 ? [emptyRow()] : rows.filter((_, i) => i !== index)
                  )
                }
              >
                Quitar
              </button>
            </div>
          ))}

          <div className="actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setRecipeRows((rows) => [...rows, emptyRow()])}
            >
              + Ingrediente
            </button>
          </div>

          <label className={`switch${active ? " on" : ""}`}>
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            <span className="switch-ui" />
            <span className="switch-label">
              {active ? "Activo en la carta" : "Fuera de la carta"}
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
                  : "Guardar plato"}
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2>Catálogo</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Plato</th>
                <th>Precio</th>
                <th>Receta</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {dishes.map((dish) => (
                <tr key={dish.id}>
                  <td>
                    <strong>{dish.name}</strong>
                    {dish.description ? (
                      <div className="hint">{dish.description}</div>
                    ) : null}
                  </td>
                  <td>S/ {Number(dish.price).toFixed(2)}</td>
                  <td>
                    {(dish.recipe_items || []).length
                      ? (dish.recipe_items || [])
                          .map(
                            (item) =>
                              `${item.ingredient?.name || item.ingredient_id} (${Number(item.quantity)} ${item.ingredient?.unit || ""})`
                          )
                          .join(", ")
                      : "Sin receta"}
                  </td>
                  <td>
                    <span
                      className={`badge ${dish.is_active ? "badge-ok" : "badge-danger"}`}
                    >
                      {dish.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td>
                    <div className="actions">
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => startEdit(dish)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => toggleDish(dish)}
                      >
                        {dish.is_active ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {dishes.length === 0 ? (
            <div className="empty">Aún no hay platos en la carta</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
