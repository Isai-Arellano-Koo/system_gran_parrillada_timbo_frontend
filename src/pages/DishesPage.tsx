import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { catalogApi } from "../api/services";
import { ApiError } from "../api/client";
import type { Dish, Ingredient } from "../types";

export function DishesPage() {
  const { token } = useAuth();
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [selectedDish, setSelectedDish] = useState<number | "">("");
  const [recipeRows, setRecipeRows] = useState([
    { ingredient_id: "", quantity: "" },
  ]);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const load = async () => {
    if (!token) return;
    const [dishList, ingredientList] = await Promise.all([
      catalogApi.listDishes(token),
      catalogApi.listIngredients(token),
    ]);
    setDishes(dishList);
    setIngredients(ingredientList.filter((i) => i.is_active));
  };

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof ApiError ? err.message : "Error al cargar")
    );
  }, [token]);

  const createDish = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError("");
    setOk("");
    try {
      await catalogApi.createDish(token, {
        name,
        price: Number(price),
        description,
      });
      setName("");
      setPrice("");
      setDescription("");
      setOk("Plato registrado");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar");
    }
  };

  const saveRecipe = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !selectedDish) return;
    setError("");
    setOk("");
    try {
      const items = recipeRows
        .filter((r) => r.ingredient_id && r.quantity)
        .map((r) => ({
          ingredient_id: Number(r.ingredient_id),
          quantity: Number(r.quantity),
        }));
      await catalogApi.setRecipe(token, Number(selectedDish), items);
      setOk("Receta asociada al plato");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar la receta");
    }
  };

  const toggleDish = async (dish: Dish) => {
    if (!token) return;
    try {
      await catalogApi.updateDish(token, dish.id, { is_active: !dish.is_active });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo actualizar");
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Platos y recetas</h1>
          <p>HU04 / HU05 — Catálogo de platos y consumo por receta.</p>
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {ok ? <div className="alert alert-ok">{ok}</div> : null}

      <div className="grid-2">
        <section className="panel">
          <h2>Nuevo plato</h2>
          <form className="form-grid" onSubmit={createDish}>
            <label>
              Nombre
              <input value={name} onChange={(e) => setName(e.target.value)} required />
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
            <label>
              Descripción
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <button className="btn btn-primary" type="submit">
              Guardar plato
            </button>
          </form>
        </section>

        <section className="panel">
          <h2>Asociar receta</h2>
          <form className="form-grid" onSubmit={saveRecipe}>
            <label>
              Plato
              <select
                value={selectedDish}
                onChange={(e) =>
                  setSelectedDish(e.target.value ? Number(e.target.value) : "")
                }
                required
              >
                <option value="">Seleccionar...</option>
                {dishes.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>

            {recipeRows.map((row, idx) => (
              <div className="form-row" key={idx}>
                <label>
                  Ingrediente
                  <select
                    value={row.ingredient_id}
                    onChange={(e) => {
                      const next = [...recipeRows];
                      next[idx] = { ...next[idx], ingredient_id: e.target.value };
                      setRecipeRows(next);
                    }}
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {ingredients.map((ing) => (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} ({ing.unit})
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
                    onChange={(e) => {
                      const next = [...recipeRows];
                      next[idx] = { ...next[idx], quantity: e.target.value };
                      setRecipeRows(next);
                    }}
                    required
                  />
                </label>
              </div>
            ))}

            <div className="actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() =>
                  setRecipeRows([...recipeRows, { ingredient_id: "", quantity: "" }])
                }
              >
                + Ingrediente
              </button>
              <button className="btn btn-primary" type="submit">
                Guardar receta
              </button>
            </div>
          </form>
        </section>
      </div>

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
                  <td>{dish.name}</td>
                  <td>S/ {Number(dish.price).toFixed(2)}</td>
                  <td>
                    {(dish.recipe_items || [])
                      .map(
                        (r) =>
                          `${r.ingredient?.name || r.ingredient_id} (${r.quantity})`
                      )
                      .join(", ") || "Sin receta"}
                  </td>
                  <td>
                    <span className={`badge ${dish.is_active ? "badge-ok" : "badge-danger"}`}>
                      {dish.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => toggleDish(dish)}
                    >
                      {dish.is_active ? "Desactivar" : "Activar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
