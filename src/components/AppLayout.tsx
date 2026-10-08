import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { roleLabel } from "../constants/roles";
import { ThemeToggle } from "./ThemeToggle";
import type { UserRole } from "../types";

type NavItem = {
  to: string;
  label: string;
  icon: "home" | "orders" | "dishes" | "ingredients" | "inventory" | "kitchen" | "users";
  roles: UserRole[];
};

const NAV: NavItem[] = [
  { to: "/", label: "Resumen", icon: "home", roles: ["admin", "mesero", "cocinero", "cajero"] },
  { to: "/orders", label: "Pedidos", icon: "orders", roles: ["admin", "mesero"] },
  { to: "/dishes", label: "Carta", icon: "dishes", roles: ["admin"] },
  { to: "/ingredients", label: "Ingredientes", icon: "ingredients", roles: ["admin"] },
  { to: "/inventory", label: "Inventario", icon: "inventory", roles: ["admin"] },
  { to: "/kitchen", label: "Cocina", icon: "kitchen", roles: ["admin", "cocinero", "mesero"] },
  { to: "/users", label: "Usuarios", icon: "users", roles: ["admin"] },
];

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function NavIcon({ name }: { name: NavItem["icon"] }) {
  if (name === "home") {
    return (
      <svg className="nav-ico" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    );
  }
  if (name === "orders") {
    return (
      <svg className="nav-ico" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 3h9l3 3v15H6z" />
        <path d="M15 3v3h3M9 12h6M9 16h6" />
      </svg>
    );
  }
  if (name === "dishes") {
    return (
      <svg className="nav-ico" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 10h16M6 10a6 6 0 0 0 12 0" />
        <path d="M12 16v3M9 19h6" />
      </svg>
    );
  }
  if (name === "ingredients") {
    return (
      <svg className="nav-ico" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3c2 3 2 5 0 8-2 3-2 5 0 8" />
        <path d="M8 7c2 1 4 1 8 0M7 12c2 1 5 1 10 0M8 17c2 1 4 1 8 0" />
      </svg>
    );
  }
  if (name === "inventory") {
    return (
      <svg className="nav-ico" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 7l9-4 9 4-9 4z" />
        <path d="M3 7v10l9 4 9-4V7" />
        <path d="M12 11v10" />
      </svg>
    );
  }
  if (name === "kitchen") {
    return (
      <svg className="nav-ico" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 3v8M6 3v5M10 3v5M8 11v10" />
        <path d="M14 3h3a3 3 0 0 1 0 6h-3V3zM17 9v12" />
      </svg>
    );
  }
  return (
    <svg className="nav-ico" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3" />
      <path d="M5 19a7 7 0 0 1 14 0" />
    </svg>
  );
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const links = NAV.filter((item) => user && item.roles.includes(user.role));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-logo" src="/LOGO_TIMBO.png" alt="Gran Parrillada Timbó" />
        </div>

        {user?.role === "admin" ? <p className="nav-section">ADMINISTRACIÓN</p> : null}

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
              <NavIcon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          <button type="button" className="btn btn-ghost" onClick={logout}>
            <svg className="nav-ico" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10 7V5a2 2 0 0 1 2-2h7v18h-7a2 2 0 0 1-2-2v-2" />
              <path d="M15 12H3m0 0 3-3M3 12l3 3" />
            </svg>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="topbar-title">Gran Parrillada Timbó</div>
          <div className="topbar-actions">
            <ThemeToggle />
            {user ? (
              <div className="topbar-user">
                <span className="topbar-avatar">{initials(user.name)}</span>
                <div>
                  <strong>{user.name}</strong>
                  <span>{roleLabel(user.role)}</span>
                </div>
              </div>
            ) : null}
          </div>
        </header>
        <main className="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
