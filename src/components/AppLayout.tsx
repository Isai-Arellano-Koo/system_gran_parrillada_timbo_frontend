import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { UserRole } from "../types";

type NavItem = {
  to: string;
  label: string;
  roles: UserRole[];
};

const NAV: NavItem[] = [
  { to: "/", label: "Inicio", roles: ["admin", "mesero", "cocinero"] },
  { to: "/ingredients", label: "Ingredientes", roles: ["admin"] },
  { to: "/dishes", label: "Platos y recetas", roles: ["admin"] },
  { to: "/inventory", label: "Inventario", roles: ["admin"] },
  { to: "/orders", label: "Pedidos", roles: ["admin", "mesero"] },
  { to: "/kitchen", label: "Cocina", roles: ["admin", "cocinero", "mesero"] },
];

export function AppLayout() {
  const { user, logout } = useAuth();

  const links = NAV.filter((item) => user && item.roles.includes(user.role));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            Gran Parrillada <span>Timbó</span>
          </div>
          <div className="brand-sub">Operación salón · cocina · stock</div>
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
            <span>{user?.role}</span>
          </div>
          <button type="button" className="btn btn-ghost" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
