import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { UserRole } from "../types";

export function ProtectedRoute({ roles }: { roles?: UserRole[] }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  // Si el rol no corresponde, lo mandamos al resumen
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
