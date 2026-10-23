import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { catalogApi } from "../api/services";
import { ApiError } from "../api/client";
import type { Dish, Ingredient } from "../types";
import { dishLabel } from "../types";

type RecipeLine = {
  ingredient_id: number;
  name: string;
  unit: string;
  quantity: number;
};

function linesFromDish(dish: Dish | null): RecipeLine[] {
  return (dish?.recipe_items || []).map((item) => ({
    ingredient_id: item.ingredient_id,
    name: item.ingredient?.name || String(item.ingredient_id),
    unit: item.ingredient?.unit || "",
    quantity: Number(item.quantity),
  }));
}

export function DishRecipePage({ embedded = false }: { embedded?: boolean }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [dishId, setDishId] = useState(id || "");
  const [lines, setLines] = useState<RecipeLine[]>([]);
  const [pickId, setPickId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedDish = dishes.find((dish) => String(dish.id) === dishId) || null;
  const picked = ingredients.find((item) => String(item.id) === pickId);

  const load = async () => {
    if (!token) return;
    const [dishList, ingredientList] = await Promise.all([
      catalogApi.listDishes(token),
      catalogApi.listIngredients(token),
    ]);
    setDishes(dishList);
    setIngredients(ingredientList.filter((item) => item.is_active));
  };

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof ApiError ? err.message : "Error al cargar")
    );
  }, [token]);

  useEffect(() => {
    if (id) setDishId(id);
  }, [id]);

  useEffect(() => {
    const dish = dishes.find((item) => String(item.id) === dishId) || null;
    setLines(linesFromDish(dish));
    setPickId("");
    setQuantity("");
    setOk("");
  }, [dishId, dishes]);

  const chooseDish = (nextId: string) => {
    setDishId(nextId);
    if (nextId) navigate(`/dishes/${nextId}/receta`, { replace: true });
    else navigate("/dishes/recetas", { replace: true });
  };

  const addLine = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setOk("");
    if (!dishId) {
      setError("Selecciona un plato");
      return;
    }
    if (!picked) {
      setError("Selecciona un ingrediente");
      return;
    }
    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      setError("La cantidad debe ser mayor que cero");
      return;
    }
    if (lines.some((line) => line.ingredient_id === picked.id)) {
      setError("No se puede repetir un ingrediente en la misma receta");
      return;
    }
    setLines((current) => [
      ...current,
      {
        ingredient_id: picked.id,
        name: picked.name,
        unit: picked.unit,
        quantity: qty,
      },
    ]);
    setPickId("");
    setQuantity("");
  };

  const removeLine = (ingredientId: number) => {
    setLines((current) => current.filter((line) => line.ingredient_id !== ingredientId));
  };

  const save = async () => {
    if (!token || !dishId) {
      setError("Selecciona un plato");
      return;
    }
    if (lines.length === 0) {
      setError("La receta debe tener al menos un ingrediente");
      return;
    }
    setSaving(true);
    setError("");
    setOk("");
    try {
      await catalogApi.setRecipe(
        token,
        Number(dishId),
        lines.map((line) => ({
          ingredient_id: line.ingredient_id,
          quantity: line.quantity,
        }))
      );
      setOk("Receta guardada. Los pedidos ya confirmados no se recalculan.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar la receta");
    } finally {
      setSaving(false);
    }
  };

  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return lines;
    return lines.filter(
      (line) =>
        line.name.toLowerCase().includes(text) ||
        line.unit.toLowerCase().includes(text)
    );
  }, [lines, query]);

  const availableIngredients = ingredients.filter(
    (item) => !lines.some((line) => line.ingredient_id === item.id)
  );

  return (
    <div>
      {embedded ? null : (
        <div className="page-head">
          <div>
            <p className="crumb">Administración › Carta › Recetas</p>
            <h1>Asociación de Recetas</h1>
            <p>Vincula ingredientes y cantidades a cada plato para el descuento de stock.</p>
          </div>
          <Link className="btn btn-ghost" to="/dishes">
            Volver a fichas
          </Link>
        </div>
      )}

      {error ? <div className="alert alert-error">{error}</div> : null}
      {ok ? <div className="alert alert-ok">{ok}</div> : null}

      <div className="grid-2">
        <section className="panel">
          <h2>Selección de Plato</h2>
          <p className="page-lead">Selecciona el plato para vincular su receta.</p>

          <label>
            Plato
            <select value={dishId} onChange={(e) => chooseDish(e.target.value)}>
              <option value="">Seleccionar plato, ej: Bife de Chorizo</option>
              {dishes.map((dish) => (
                <option key={dish.id} value={dish.id}>
                  {dish.category?.name ? `${dish.category.name} · ` : ""}
                  {dishLabel(dish)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Estado de la receta
            <input
              value={
                !selectedDish
                  ? "—"
                  : selectedDish.is_active
                    ? "Activa"
                    : "Inactiva"
              }
              disabled
            />
          </label>
          <p className="hint">
            La receta debe tener al menos un ingrediente y no se permiten insumos
            duplicados.
          </p>

          <form className="form-grid" onSubmit={addLine}>
            <h2>Agregar ingrediente a la receta</h2>
            <label>
              Seleccionar ingrediente
              <select
                value={pickId}
                onChange={(e) => setPickId(e.target.value)}
                disabled={!dishId}
              >
                <option value="">Buscar ingrediente...</option>
                {availableIngredients.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.unit})
                  </option>
                ))}
              </select>
            </label>
            <div className="form-row">
              <label>
                Cantidad
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0.00"
                  disabled={!dishId}
                />
              </label>
              <label>
                Automática
                <input value={picked?.unit || "—"} disabled />
              </label>
            </div>
            <button className="btn btn-ghost" type="submit" disabled={!dishId}>
              + Agregar
            </button>
          </form>

          <div className="form-footer">
            <Link className="btn btn-ghost" to="/dishes">
              Cancelar
            </Link>
            <button
              className="btn btn-primary"
              type="button"
              disabled={saving || !dishId}
              onClick={save}
            >
              {saving ? "Guardando..." : "Guardar Receta"}
            </button>
          </div>
        </section>

        <section className="panel">
          <div className="list-head">
            <div>
              <h2>Ingredientes de la receta</h2>
              <p>
                {visible.length} {visible.length === 1 ? "ingrediente" : "ingredientes"}
              </p>
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar ingrediente..."
              aria-label="Buscar ingrediente"
            />
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ingrediente</th>
                  <th>Cantidad</th>
                  <th>Unidad</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((line) => (
                  <tr key={line.ingredient_id}>
                    <td>
                      <strong>{line.name}</strong>
                    </td>
                    <td>{line.quantity}</td>
                    <td>{line.unit}</td>
                    <td>
                      <button
                        type="button"
                        className="icon-link"
                        onClick={() => removeLine(line.ingredient_id)}
                        aria-label={`Quitar ${line.name}`}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M4 7h16" />
                          <path d="M9 7V5h6v2" />
                          <path d="M7 7l1 13h8l1-13" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visible.length === 0 ? (
              <div className="empty">
                {dishId
                  ? "Esta receta todavía no tiene ingredientes"
                  : "Selecciona un plato para ver su receta"}
              </div>
            ) : null}
          </div>
          <div className="list-foot">
            <span>
              Mostrando {visible.length} de {lines.length}{" "}
              {lines.length === 1 ? "ingrediente" : "ingredientes"}
            </span>
            <span>Sin duplicados detectados</span>
          </div>
        </section>
      </div>
    </div>
  );
}
