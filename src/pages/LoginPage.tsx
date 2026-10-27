import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { authApi } from "../api/services";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";

const REMEMBER_KEY = "timbo_login_id";

type Screen = "login" | "confirm" | "locked" | "reset";

export function LoginPage() {
  const { user, login, confirmEmail } = useAuth();
  const remembered = localStorage.getItem(REMEMBER_KEY) ?? "";
  const [identifier, setIdentifier] = useState(remembered);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(Boolean(remembered));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [screen, setScreen] = useState<Screen>("login");
  const [confirmationToken, setConfirmationToken] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [code, setCode] = useState("");
  const [info, setInfo] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetSent, setResetSent] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const value = identifier.trim();
      if (remember) localStorage.setItem(REMEMBER_KEY, value);
      else localStorage.removeItem(REMEMBER_KEY);
      const pending = await login(value, password);
      if (pending) {
        setConfirmationToken(pending.confirmationToken);
        setPendingEmail(pending.email);
        setInfo(pending.message);
        setCode("");
        setScreen("confirm");
      }
    } catch (err) {
      if (err instanceof ApiError && err.payload.locked) {
        setError(err.message);
        setScreen("locked");
        return;
      }
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  const onConfirm = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await confirmEmail(confirmationToken, code.trim());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo confirmar el correo");
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await authApi.resendConfirmEmail(confirmationToken);
      setInfo(result.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo reenviar el código");
    } finally {
      setLoading(false);
    }
  };

  const sendResetCode = async () => {
    const value = identifier.trim();
    if (!value) {
      setError("Indica el usuario o el correo de la cuenta");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const result = await authApi.requestPasswordReset(value);
      setInfo(result.message);
      setResetSent(true);
      setScreen("reset");
      setCode("");
      setNewPassword("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo enviar el código");
    } finally {
      setLoading(false);
    }
  };

  const onReset = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await authApi.confirmPasswordReset(
        identifier.trim(),
        code.trim(),
        newPassword
      );
      setInfo(result.message);
      setPassword("");
      setCode("");
      setNewPassword("");
      setResetSent(false);
      setScreen("login");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cambiar la contraseña");
    } finally {
      setLoading(false);
    }
  };

  const otherAccount = () => {
    setScreen("login");
    setIdentifier("");
    setPassword("");
    setError("");
    setInfo("");
    setLockedClear();
  };

  const setLockedClear = () => {
    setResetSent(false);
    setCode("");
    setNewPassword("");
  };

  if (screen === "confirm") {
    return (
      <div className="login-page">
        <form className="login-card" onSubmit={onConfirm}>
          <div className="login-brand">
            <img src="/LOGO_TIMBO.png" alt="Gran Parrillada Timbó" />
            <p>Confirma tu correo para activar la cuenta</p>
          </div>

          {error ? <div className="alert alert-error">{error}</div> : null}
          {info ? <p className="forgot-note">{info}</p> : null}

          <label className="login-field">
            <span>Código enviado a {pendingEmail}</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6 dígitos"
              required
            />
          </label>

          <button className="btn btn-primary login-submit" type="submit" disabled={loading}>
            {loading ? "Confirmando..." : "Confirmar correo"}
          </button>
          <button
            className="btn btn-ghost login-submit"
            type="button"
            disabled={loading}
            onClick={onResend}
          >
            Reenviar código
          </button>
        </form>
      </div>
    );
  }

  if (screen === "locked") {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-brand">
            <img src="/LOGO_TIMBO.png" alt="Gran Parrillada Timbó" />
            <p>Esta cuenta quedó bloqueada un rato</p>
          </div>
          {error ? <div className="alert alert-error">{error}</div> : null}
          <p className="forgot-note">
            Después de 5 intentos fallidos hay que esperar 15 minutos, o restablecer la
            contraseña con el código que llega al correo.
          </p>
          <button
            className="btn btn-primary login-submit"
            type="button"
            disabled={loading}
            onClick={sendResetCode}
          >
            Restablecer contraseña
          </button>
          <button
            className="btn btn-ghost login-submit"
            type="button"
            onClick={otherAccount}
          >
            Entrar con otra cuenta
          </button>
        </div>
      </div>
    );
  }

  if (screen === "reset") {
    return (
      <div className="login-page">
        <form className="login-card" onSubmit={onReset}>
          <div className="login-brand">
            <img src="/LOGO_TIMBO.png" alt="Gran Parrillada Timbó" />
            <p>Restablecer contraseña</p>
          </div>
          {error ? <div className="alert alert-error">{error}</div> : null}
          {info ? <p className="forgot-note">{info}</p> : null}

          {!resetSent ? (
            <>
              <label className="login-field">
                <span>Nombre de usuario o correo</span>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  autoComplete="username"
                />
              </label>
              <button
                className="btn btn-primary login-submit"
                type="button"
                disabled={loading}
                onClick={sendResetCode}
              >
                {loading ? "Enviando..." : "Enviar código"}
              </button>
            </>
          ) : (
            <>
              <label className="login-field">
                <span>Código de 6 dígitos</span>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6 dígitos"
                  required
                />
              </label>
              <label className="login-field">
                <span>Nueva contraseña</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                  required
                  autoComplete="new-password"
                />
              </label>
              <button className="btn btn-primary login-submit" type="submit" disabled={loading}>
                {loading ? "Guardando..." : "Cambiar contraseña"}
              </button>
            </>
          )}
          <button
            className="btn btn-ghost login-submit"
            type="button"
            onClick={otherAccount}
          >
            Volver al inicio de sesión
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="login-brand">
          <img src="/LOGO_TIMBO.png" alt="Gran Parrillada Timbó" />
          <p>Inicia sesión con tu cuenta de colaborador</p>
        </div>

        {error ? <div className="alert alert-error">{error}</div> : null}
        {info ? <p className="forgot-note">{info}</p> : null}

        <label className="login-field">
          <span>Nombre de usuario o correo</span>
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="p. ej. denis.rodriguez"
            required
            autoComplete="username"
          />
        </label>

        <label className="login-field">
          <span>Contraseña</span>
          <div className="password-field">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
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
        </label>

        <div className="login-options">
          <label className="remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            Recordar cuenta
          </label>
          <button
            type="button"
            className="forgot-link"
            onClick={() => {
              setError("");
              setInfo("");
              setResetSent(false);
              setScreen("reset");
            }}
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>

        <button className="btn btn-primary login-submit" type="submit" disabled={loading}>
          {loading ? "Ingresando..." : "Iniciar Sesión"}
        </button>
      </form>
    </div>
  );
}
