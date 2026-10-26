import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { roleAvatar, roleLabel } from "../constants/roles";
import { ThemeToggle } from "./ThemeToggle";
import type { UserRole } from "../types";

type NavItem = {
  to: string;
  label: string;
  icon: "home" | "orders" | "dishes" | "categories" | "ingredients" | "inventory" | "kitchen" | "users";
  roles: UserRole[];
};

const NAV: NavItem[] = [
  { to: "/", label: "Resumen", icon: "home", roles: ["admin", "mesero", "cocinero", "cajero"] },
  { to: "/orders", label: "Pedidos", icon: "orders", roles: ["admin", "mesero"] },
  { to: "/dishes", label: "Carta", icon: "dishes", roles: ["admin", "mesero"] },
  { to: "/categories", label: "Categorías", icon: "categories", roles: ["admin"] },
  { to: "/ingredients", label: "Ingredientes", icon: "ingredients", roles: ["admin"] },
  { to: "/inventory", label: "Inventario", icon: "inventory", roles: ["admin"] },
  { to: "/kitchen", label: "Cocina", icon: "kitchen", roles: ["admin", "cocinero", "mesero"] },
  { to: "/users", label: "Usuarios", icon: "users", roles: ["admin"] },
];

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
  if (name === "categories") {
    return (
      <svg className="nav-ico" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 6h16M4 12h10M4 18h16" />
        <circle cx="18" cy="12" r="2" />
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
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const links = NAV.filter((item) => user && item.roles.includes(user.role));

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <div className={`app-shell${menuOpen ? " nav-open" : ""}`}>
      <button
        type="button"
        className="nav-backdrop"
        aria-label="Cerrar menú"
        tabIndex={menuOpen ? 0 : -1}
        onClick={() => setMenuOpen(false)}
      />

      <aside className="sidebar" id="app-sidebar">
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
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          <button type="button" className="btn btn-ghost" onClick={logout}>
            <svg className="nav-ico" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10 7V5a2 2 0 0 1 2-2h7v18h-7a2 2 0 0 1-2-2v-2" />
              <path d="M15 12H3m0 0 3-3M3 12l3 3" />
            </svg>
            <span className="nav-label">Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="topbar-start">
            <button
              type="button"
              className="menu-btn"
              aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={menuOpen}
              aria-controls="app-sidebar"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              )}
            </button>
            <div className="topbar-title">Gran Parrillada Timbó</div>
          </div>
          <div className="topbar-actions">
            <ThemeToggle />
            {user ? (
              <div className="topbar-user">
                <img
                  className="topbar-avatar"
                  src={roleAvatar(user.role)}
                  alt={roleLabel(user.role)}
                />
                <div className="topbar-user-text">
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
