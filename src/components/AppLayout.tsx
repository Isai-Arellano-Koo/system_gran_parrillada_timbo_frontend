import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { roleLabel } from "../constants/roles";
import { ThemeToggle } from "./ThemeToggle";
import type { UserRole } from "../types";

type NavItem = {
  to: string;
  label: string;
  roles: UserRole[];
};

const NAV: NavItem[] = [
  { to: "/", label: "Resumen", roles: ["admin", "mesero", "cocinero"] },
  { to: "/orders", label: "Pedidos", roles: ["admin", "mesero"] },
  { to: "/dishes", label: "Carta", roles: ["admin"] },
  { to: "/ingredients", label: "Ingredientes", roles: ["admin"] },
  { to: "/inventory", label: "Inventario", roles: ["admin"] },
  { to: "/kitchen", label: "Cocina", roles: ["admin", "cocinero", "mesero"] },
  { to: "/users", label: "Usuarios", roles: ["admin"] },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const links = NAV.filter((item) => user && item.roles.includes(user.role));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">Gran Timbó</div>
          <div className="brand-sub">Restaurante</div>
        </div>

        <nav className="nav-list">
          {links.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `nav-link${isActive ? " active" : ""}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="user-chip">
            <strong>{user?.name}</strong>
            <span>{user ? roleLabel(user.role) : ""}</span>
          </div>
          <button type="button" className="btn btn-ghost" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="topbar-title">Gran Timbó · Sede Centro</div>
          <ThemeToggle />
        </header>
        <main className="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
