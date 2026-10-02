import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { usersApi } from "../api/services";
import { ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { ROLE_OPTIONS } from "../constants/roles";
import type { UserRole } from "../types";

const USERNAME_RE = /^[a-z0-9.]+$/;

export function UserFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const { token, user, patchSessionUser } = useAuth();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole>("mesero");
  const [active, setActive] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);

  const isSelf = editing && user?.id === Number(id);

  useEffect(() => {
    if (!editing || !token || !id) return;
    let cancelled = false;
    usersApi
      .get(token, Number(id))
      .then((account) => {
        if (cancelled) return;
        setName(account.name);
        setUsername(account.username || "");
        setEmail(account.email);
        setRole(account.role);
        setActive(account.is_active !== false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "No se pudo cargar el usuario");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editing, token, id]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError("");

    const cleanUsername = username.trim().toLowerCase();
    if (!USERNAME_RE.test(cleanUsername)) {
      setError("El nombre de usuario solo puede tener letras, números y puntos, sin espacios");
      return;
    }
    if (!editing && password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (editing && password && password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    setSaving(true);
    try {
      if (editing && id) {
        const updated = await usersApi.update(token, Number(id), {
          name: name.trim(),
          username: cleanUsername,
          email: email.trim(),
          role,
          is_active: active,
          ...(password ? { password } : {}),
        });
        if (isSelf) {
          patchSessionUser({
            name: updated.name,
            username: updated.username,
            email: updated.email,
          });
        }
        navigate("/users", {
          state: { message: "Usuario actualizado" },
        });
        return;
      }

      await usersApi.create(token, {
        name: name.trim(),
        username: cleanUsername,
        email: email.trim(),
        password,
        role,
        is_active: active,
      });
      navigate("/users", {
        state: { message: "Usuario registrado" },
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="user-page">
      <p className="crumb">
        Administración › Usuarios › {editing ? "Editar usuario" : "Nuevo usuario"}
      </p>
      <Link className="back-link" to="/users">
        ← Volver a usuarios
      </Link>
      <h1>{editing ? "Editar usuario" : "Registrar Nuevo Usuario"}</h1>
      <p className="page-lead">
        {editing
          ? "Actualiza los datos de la persona y define su acceso al panel."
          : "Suma una persona a tu equipo y define su acceso al panel del restaurante."}
      </p>

      {loading ? <div className="panel empty">Cargando usuario...</div> : null}

      {!loading ? (
        <div className="user-layout">
          <form className="panel user-form" onSubmit={onSubmit}>
            <h2>Datos del usuario</h2>
            {error ? <div className="alert alert-error">{error}</div> : null}

            <label className="field">
              <span>
                Nombre completo <em>*</em>
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Daniel Rodríguez"
                required
                autoComplete="name"
              />
            </label>

            <label className="field">
              <span>
                Nombre de usuario <em>*</em>
              </span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                placeholder="Ej. daniel.rodriguez"
                required
                autoComplete="off"
                spellCheck={false}
              />
              <small>Sin espacios. Solo letras, números y puntos.</small>
            </label>

            <label className="field">
              <span>
                Correo electrónico <em>*</em>
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ej. daniel.rodriguez@timbo.com"
                required
                autoComplete="off"
              />
            </label>

            <label className="field">
              <span>
                Contraseña {editing ? null : <em>*</em>}
              </span>
              <div className="password-field">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={editing ? "Dejar en blanco para no cambiarla" : ""}
                  required={!editing}
                  minLength={editing ? undefined : 8}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3 3l18 18" />
                      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                      <path d="M9.9 5.1A9.8 9.8 0 0 1 12 5c5 0 9.3 3.1 11 7-.6 1.4-1.6 2.7-2.8 3.8M6.1 6.1C4.2 7.3 2.7 9 1 12c1.7 3.9 6 7 11 7 1.6 0 3.1-.3 4.5-.9" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              <small>Usa al menos 8 caracteres.</small>
            </label>

            <label className="field">
              <span>
                Rol <em>*</em>
              </span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                disabled={isSelf}
                required
              >
                {ROLE_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              {isSelf ? (
                <small>No puedes cambiar tu propio rol desde esta cuenta.</small>
              ) : null}
            </label>

            <div className="status-row">
              <div>
                <strong>Estado</strong>
                <p>Activo: puede iniciar sesión. Inactivo: acceso suspendido.</p>
              </div>
              <label className={`switch${active ? " on" : ""}`}>
                <input
                  type="checkbox"
                  checked={active}
                  disabled={isSelf}
                  onChange={(e) => setActive(e.target.checked)}
                />
                <span className="switch-ui" />
                <span className="switch-label">{active ? "Activo" : "Inactivo"}</span>
              </label>
            </div>

            <div className="form-footer">
              <Link className="btn btn-ghost" to="/users">
                Cancelar
              </Link>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving
                  ? "Guardando..."
                  : editing
                    ? "Guardar cambios"
                    : "Registrar Usuario"}
              </button>
            </div>
          </form>

          <aside className="panel role-guide">
            <h2>Un rol para cada perfil</h2>
            <p className="lead">
              Asigna accesos específicos para mantener la seguridad de la
              información y ordenar el flujo de trabajo de tu equipo.
            </p>
            {ROLE_OPTIONS.map((item) => (
              <article className="role-item" key={item.value}>
                <strong>{item.label}</strong>
                <p>{item.description}</p>
              </article>
            ))}
          </aside>
        </div>
      ) : null}
    </div>
  );
}
