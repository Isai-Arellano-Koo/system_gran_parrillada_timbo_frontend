import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { ordersApi } from "../api/services";
import { ApiError } from "../api/client";
import type { TableChange, TableItem } from "../types";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function TablesPage() {
  const { token } = useAuth();
  const [tables, setTables] = useState<TableItem[]>([]);
  const [changes, setChanges] = useState<TableChange[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [reasonFor, setReasonFor] = useState<TableItem | null>(null);
  const [reason, setReason] = useState("");

  const load = async () => {
    if (!token) return;
    const [list, history] = await Promise.all([
      ordersApi.listTables(token),
      ordersApi.tableChanges(token),
    ]);
    setTables(list);
    setChanges(history);
  };

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof ApiError ? err.message : "Error al cargar")
    );
  }, [token]);

  const selectedTables = useMemo(
    () => tables.filter((table) => selected.includes(table.id)),
    [tables, selected]
  );

  const toggle = (table: TableItem) => {
    if (!table.is_active || table.occupied) return;
    setSelected((prev) =>
      prev.includes(table.id)
        ? prev.filter((id) => id !== table.id)
        : [...prev, table.id]
    );
  };

  const groupSelected = async () => {
    if (!token || selected.length < 2) return;
    setBusy(true);
    setError("");
    try {
      const list = await ordersApi.groupTables(token, selected);
      setTables(list);
      setSelected([]);
      setMessage("Mesas agrupadas");
      const history = await ordersApi.tableChanges(token);
      setChanges(history);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudieron agrupar");
    } finally {
      setBusy(false);
    }
  };

  const ungroup = async (groupId: number) => {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const list = await ordersApi.ungroupTables(token, groupId);
      setTables(list);
      setSelected([]);
      setMessage("Grupo separado");
      setChanges(await ordersApi.tableChanges(token));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo separar");
    } finally {
      setBusy(false);
    }
  };

  const submitStatus = async () => {
    if (!token || !reasonFor) return;
    setBusy(true);
    setError("");
    try {
      await ordersApi.setTableActive(
        token,
        reasonFor.id,
        !reasonFor.is_active,
        reason.trim()
      );
      setReasonFor(null);
      setReason("");
      setMessage(
        reasonFor.is_active ? "Mesa inhabilitada" : "Mesa habilitada"
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cambiar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Mesas del salón</h1>
          <p>
            Habilita, inhabilita o agrupa mesas libres. No se puede cambiar una
            mesa con pedido abierto.
          </p>
        </div>
        <div className="actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || selected.length < 2}
            onClick={() => void groupSelected()}
          >
            Agrupar {selected.length > 1 ? `(${selected.length})` : ""}
          </button>
        </div>
      </div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      {message ? <div className="alert alert-ok">{message}</div> : null}

      <section className="panel">
        <p className="muted table-join-hint">
          Toca mesas libres para seleccionarlas y agruparlas. Las ocupadas no se
          pueden inhabilitar ni agrupar.
        </p>
        <div className="table-grid">
          {tables.map((table) => {
            const grouped = (table.group_numbers?.length || 0) > 1;
            const on = selected.includes(table.id);
            return (
              <article
                key={table.id}
                className={`table-tile admin-table${
                  table.is_active ? "" : " inactive"
                }${table.occupied ? " occupied" : ""}${
                  grouped ? " joined" : ""
                }${on ? " drop-target" : ""}`}
              >
                <button
                  type="button"
                  className="admin-table-hit"
                  disabled={busy || !table.is_active || table.occupied}
                  onClick={() => toggle(table)}
                >
                  <strong>Mesa {pad(table.number)}</strong>
                  <span>
                    {!table.is_active
                      ? "Inhabilitada"
                      : table.occupied
                        ? "Ocupada"
                        : grouped
                          ? `Grupo ${table.group_numbers?.map(pad).join(" + ")}`
                          : "Libre"}
                  </span>
                </button>
                <div className="admin-table-actions">
                  {grouped && table.group_id && !table.occupied ? (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={busy}
                      onClick={() => void ungroup(table.group_id!)}
                    >
                      Separar
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={`btn ${table.is_active ? "btn-ghost" : "btn-primary"}`}
                    disabled={busy || table.occupied}
                    onClick={() => {
                      setReason("");
                      setReasonFor(table);
                    }}
                  >
                    {table.is_active ? "Inhabilitar" : "Habilitar"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <h2>Registro de cambios</h2>
        {!changes.length ? (
          <p className="muted">Todavía no hay cambios de mesas.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cambio</th>
                  <th>Motivo</th>
                  <th>Quién</th>
                </tr>
              </thead>
              <tbody>
                {changes.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.at ? new Date(item.at).toLocaleString() : "—"}
                    </td>
                    <td>
                      {item.table_number
                        ? `Mesa ${pad(item.table_number)} · ${item.detail}`
                        : item.detail}
                    </td>
                    <td>{item.reason || "—"}</td>
                    <td>{item.user_name || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {reasonFor ? (
        <div
          className="dialog-backdrop"
          role="presentation"
          onClick={() => !busy && setReasonFor(null)}
        >
          <div
            className="dialog panel"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <h2>
              {reasonFor.is_active ? "Inhabilitar" : "Habilitar"} mesa{" "}
              {pad(reasonFor.number)}
            </h2>
            <label>
              Motivo
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                required
              />
            </label>
            <div className="form-footer">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setReasonFor(null)}
                disabled={busy}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !reason.trim()}
                onClick={() => void submitStatus()}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedTables.length ? (
        <p className="muted">
          Seleccionadas:{" "}
          {selectedTables.map((table) => pad(table.number)).join(", ")}
        </p>
      ) : null}
    </div>
  );
}
