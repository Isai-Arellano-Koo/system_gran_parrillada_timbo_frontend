import { useEffect, useState } from "react";
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

  const load = async () => {
    if (!token) return;
    setItems(await usersApi.list(token));
  };

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof ApiError ? err.message : "Error al cargar usuarios")
    );
  }, [token]);

  const changeRole = async (item: User, role: UserRole) => {
    if (!token || role === item.role) return;
    setError("");
    setOk("");
    setSavingId(item.id);
    try {
      await usersApi.update(token, item.id, { role });
      setOk(`Rol de ${item.name} actualizado a ${roleLabel(role)}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cambiar el rol");
    } finally {
      setSavingId(null);
    }
  };

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

  return (
    <div>
      <div className="page-head">
        <div>
          <p className="crumb">Administración › Usuarios</p>
          <h1>Usuarios</h1>
          <p>Personas con acceso al panel. Puedes cambiar el rol de los demás.</p>
        </div>
        <Link className="btn btn-primary" to="/users/nuevo">
          Nuevo usuario
        </Link>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {ok ? <div className="alert alert-ok">{ok}</div> : null}

      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Usuario</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isSelf = item.id === user?.id;
                const busy = savingId === item.id;
                return (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>
                      {isSelf ? <div className="hint">Tu cuenta</div> : null}
                    </td>
                    <td>{item.username || "—"}</td>
                    <td>{item.email}</td>
                    <td>
                      <select
                        className="select-inline"
                        value={item.role}
                        disabled={isSelf || busy}
                        aria-label={`Rol de ${item.name}`}
                        onChange={(e) =>
                          changeRole(item, e.target.value as UserRole)
                        }
                      >
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`badge ${item.is_active === false ? "badge-danger" : "badge-ok"}`}
                        disabled={isSelf || busy}
                        onClick={() => toggleActive(item)}
                      >
                        {item.is_active === false ? "Inactivo" : "Activo"}
                      </button>
                    </td>
                    <td>
                      <Link className="btn btn-ghost" to={`/users/${item.id}`}>
                        Editar
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {items.length === 0 ? (
            <div className="empty">Aún no hay usuarios</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
