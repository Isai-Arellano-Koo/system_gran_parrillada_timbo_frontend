import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLiveReload } from "../context/LiveContext";
import { ordersApi } from "../api/services";
import { ApiError } from "../api/client";
import type { AttentionModality, SoldDish } from "../types";
import { attentionLabel } from "../types";
import { matchesQuery } from "../helpers/search";
import { usePagedRows } from "../helpers/pagination";
import { TablePager } from "../components/TablePager";

function money(value: number | string) {
  return `S/ ${Number(value).toFixed(2)}`;
}

export function SoldDishesPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<SoldDish[]>([]);
  const [query, setQuery] = useState("");
  const [modality, setModality] = useState<"all" | AttentionModality>("all");
  const [error, setError] = useState("");

  const load = () => {
    if (!token) return Promise.resolve();
    return ordersApi
      .soldDishes(token)
      .then(setItems)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Error al cargar")
      );
  };

  useEffect(() => {
    void load();
  }, [token]);

  useLiveReload(["orders"], () => {
    void load();
  });

  const visible = useMemo(
    () =>
      items.filter((item) => {
        if (modality !== "all" && item.modality !== modality) return false;
        return matchesQuery(
          query,
          item.dish_name,
          item.presentation,
          item.order_code,
          attentionLabel(item.modality),
          item.table_number ? `mesa ${item.table_number}` : ""
        );
      }),
    [items, query, modality]
  );
  const paged = usePagedRows(visible, `${query}|${modality}`);
  const totalQty = visible.reduce((sum, item) => sum + Number(item.quantity), 0);
  const totalAmount = visible.reduce((sum, item) => sum + Number(item.total), 0);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Platos vendidos</h1>
          <p>
            Historial de platos confirmados, de mesa y delivery. Sirve para ver
            qué se vendió y en qué modalidad.
          </p>
        </div>
      </div>
      {error ? <div className="alert alert-error">{error}</div> : null}

      <section className="panel">
        <div className="list-head">
          <div>
            <h2>Historial</h2>
            <p>
              {visible.length} {visible.length === 1 ? "línea" : "líneas"} · {totalQty}{" "}
              platos · {money(totalAmount)}
            </p>
          </div>
        </div>
        <div className="filter-grid">
          <label>
            Buscar
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Plato, orden, mesa…"
            />
          </label>
          <label>
            Modalidad
            <select
              value={modality}
              onChange={(e) =>
                setModality(
                  e.target.value as "all" | "mesa" | "delivery" | "para_llevar"
                )
              }
            >
              <option value="all">Todas</option>
              <option value="mesa">Mesa</option>
              <option value="delivery">Delivery</option>
              <option value="para_llevar">Para llevar</option>
            </select>
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Orden</th>
                <th>Modalidad</th>
                <th>Plato</th>
                <th>Cant.</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {paged.rows.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.sold_at
                      ? new Date(item.sold_at).toLocaleString()
                      : "—"}
                  </td>
                  <td>{item.order_code}</td>
                  <td>{attentionLabel(item.modality)}</td>
                  <td>
                    <strong>{item.dish_name}</strong>
                    {item.presentation ? (
                      <div className="hint">{item.presentation}</div>
                    ) : null}
                  </td>
                  <td>{item.quantity}</td>
                  <td>{money(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visible.length ? (
            <div className="empty">Aún no hay platos vendidos</div>
          ) : null}
        </div>
        <TablePager total={visible.length} page={paged.current} onPage={paged.setPage} />
      </section>
    </div>
  );
}
