import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { usersApi } from "../api/services";
import { ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { UserStatusHistory } from "../components/UserStatusHistory";
import type { UserStatusChange } from "../types";

export function UsersHistoryPage() {
  const { token } = useAuth();
  const [changes, setChanges] = useState<UserStatusChange[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    usersApi
      .statusChanges(token)
      .then(setChanges)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Error al cargar el historial")
      );
  }, [token]);

  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return changes;
    return changes.filter((item) => {
      const user = item.user?.name || "";
      const username = item.user?.username || "";
      const actor = item.changed_by_user?.name || "";
      return (
        user.toLowerCase().includes(text) ||
        username.toLowerCase().includes(text) ||
        actor.toLowerCase().includes(text) ||
        item.reason.toLowerCase().includes(text)
      );
    });
  }, [changes, query]);

  return (
    <div>
      <div className="page-head">
        <div>
          <p className="crumb">Administración › Usuarios › Historial</p>
          <h1>Historial de cambios</h1>
          <p>
            Cada suspensión o reactivación queda con motivo, fecha, hora y quién la hizo.
          </p>
        </div>
        <Link className="btn btn-ghost" to="/users">
          Volver a usuarios
        </Link>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="user-tools">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por usuario, motivo o quien lo cambió..."
          aria-label="Buscar en el historial"
        />
      </div>

      <section className="panel">
        <div className="list-head">
          <h2>Cambios de estado</h2>
          <p>
            {visible.length} {visible.length === 1 ? "registro" : "registros"}
          </p>
        </div>
        {visible.length === 0 && changes.length === 0 ? (
          <div className="empty">Todavía no hay cambios de estado registrados.</div>
        ) : (
          <UserStatusHistory changes={visible} showUser />
        )}
      </section>
    </div>
  );
}
