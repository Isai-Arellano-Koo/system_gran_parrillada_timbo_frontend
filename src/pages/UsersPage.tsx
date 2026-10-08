import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { usersApi } from "../api/services";
import { ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { ROLE_OPTIONS, roleLabel } from "../constants/roles";
import type { User, UserRole } from "../types";

export function UsersPage() {
  const { token, user } = useAuth();
  const location = useLocation();
  const [items, setItems] = useState<User[]>([]);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(
    (location.state as { message?: string } | null)?.message || ""
  );
  const [savingId, setSavingId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "">("");

  const load = async () => {
    if (!token) return;
    setItems(await usersApi.list(token));
  };

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof ApiError ? err.message : "Error al cargar usuarios")
    );
  }, [token]);

  const toggleActive = async (item: User) => {
    if (!token) return;
    setError("");
    setOk("");
    setSavingId(item.id);
    try {
      const is_active = item.is_active === false;
      await usersApi.update(token, item.id, { is_active });
      setOk(
        is_active
          ? `${item.name} puede iniciar sesión de nuevo`
          : `Acceso de ${item.name} suspendido`
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo actualizar el estado");
    } finally {
      setSavingId(null);
    }
  };

  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesRole = !roleFilter || item.role === roleFilter;
      const matchesText =
        !text ||
        item.name.toLowerCase().includes(text) ||
        (item.username || "").toLowerCase().includes(text);
      return matchesRole && matchesText;
    });
  }, [items, query, roleFilter]);

  const inactive = items.filter((item) => item.is_active === false).length;

  return (
    <div>
      <div className="page-head">
        <div>
          <p className="crumb">Administración › Usuarios</p>
          <h1>Usuarios</h1>
          <p>Gestiona los accesos de tu equipo.</p>
        </div>
        <Link className="btn btn-primary" to="/users/nuevo">
          + Añadir Nuevo Usuario
        </Link>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {ok ? <div className="alert alert-ok">{ok}</div> : null}

      <div className="user-tools">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre o usuario..."
          aria-label="Buscar usuarios"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as UserRole | "")}
          aria-label="Filtrar por rol"
        >
          <option value="">Todos los roles</option>
          {ROLE_OPTIONS.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </select>
      </div>

      <section className="panel">
        <div className="list-head">
          <h2>Lista de Usuarios</h2>
          <p>
            {items.length} {items.length === 1 ? "usuario" : "usuarios"}
          </p>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre completo</th>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => {
                const isSelf = item.id === user?.id;
                const busy = savingId === item.id;
                return (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>
                      {isSelf ? <div className="hint">Tu cuenta</div> : null}
                    </td>
                    <td>{item.username || "—"}</td>
                    <td>{roleLabel(item.role)}</td>
                    <td>
                      {item.email_verified === false ? (
                        <span className="badge badge-warn">Pendiente</span>
                      ) : (
                        <button
                          type="button"
                          className={`badge ${item.is_active === false ? "badge-danger" : "badge-ok"}`}
                          disabled={isSelf || busy}
                          onClick={() => toggleActive(item)}
                        >
                          {item.is_active === false ? "Inactivo" : "Activo"}
                        </button>
                      )}
                    </td>
                    <td>
                      <Link
                        className="icon-link"
                        to={`/users/${item.id}`}
                        aria-label={`Editar a ${item.name}`}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z" />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visible.length === 0 ? (
            <div className="empty">No hay usuarios con ese filtro</div>
          ) : null}
        </div>
        <div className="list-foot">
          <span>
            Mostrando {visible.length} de {items.length} usuarios
          </span>
          <span>
            {inactive === 1 ? "1 usuario inactivo" : `${inactive} usuarios inactivos`}
          </span>
        </div>
      </section>
    </div>
  );
}
