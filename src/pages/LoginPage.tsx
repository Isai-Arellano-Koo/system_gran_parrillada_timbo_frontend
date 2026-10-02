import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";

export function LoginPage() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("admin@timbo.com");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card stack" onSubmit={onSubmit}>
        <div>
          <h1>
            Gran Parrillada <span>Timbó</span>
          </h1>
          <p className="lead">
            Ingresa con tu usuario para gestionar pedidos, cocina e inventario.
          </p>
        </div>

        {error ? <div className="alert alert-error">{error}</div> : null}

        <label>
          Correo
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
        </label>

        <label>
          Contraseña
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>

        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "Ingresando..." : "Iniciar sesión"}
        </button>

        <p className="muted" style={{ fontSize: "0.82rem", margin: 0 }}>
          Demo: admin@timbo.com / admin123 · mesero@timbo.com / mesero123 ·
          cocinero@timbo.com / cocinero123
        </p>
      </form>
    </div>
  );
}
