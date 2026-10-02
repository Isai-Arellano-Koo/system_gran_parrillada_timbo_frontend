import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { inventoryApi, kitchenApi, ordersApi } from "../api/services";

export function HomePage() {
  const { token, user } = useAuth();
  const [orders, setOrders] = useState(0);
  const [tickets, setTickets] = useState(0);
  const [alerts, setAlerts] = useState(0);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      try {
        const [orderList, ticketList] = await Promise.all([
          ordersApi.list(token),
          kitchenApi.list(token),
        ]);
        setOrders(orderList.filter((o) => o.status !== "cancelado").length);
        setTickets(
          ticketList.filter((t) => t.status !== "entregado").length
        );
        if (user?.role === "admin") {
          const alertList = await inventoryApi.listAlerts(token);
          setAlerts(alertList.length);
        }
      } catch {
        /* ignore summary errors */
      }
    };
    load();
  }, [token, user]);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Panel operativo</h1>
          <p>Flujo digital de salón, cocina e inventario.</p>
        </div>
      </div>

      <div className="grid-3">
        <div className="stat">
          <span>Pedidos activos</span>
          <strong>{orders}</strong>
        </div>
        <div className="stat">
          <span>Comandas en cocina</span>
          <strong>{tickets}</strong>
        </div>
        <div className="stat">
          <span>Alertas de stock</span>
          <strong>{user?.role === "admin" ? alerts : "—"}</strong>
        </div>
      </div>

      <div className="panel" style={{ marginTop: "1rem" }}>
        <h2>Accesos rápidos</h2>
        <div className="actions">
          {(user?.role === "mesero" || user?.role === "admin") && (
            <Link className="btn btn-primary" to="/orders">
              Abrir pedido
            </Link>
          )}
          {(user?.role === "cocinero" || user?.role === "admin") && (
            <Link className="btn btn-ghost" to="/kitchen">
              Ver cocina
            </Link>
          )}
          {user?.role === "admin" && (
            <>
              <Link className="btn btn-ghost" to="/dishes">
                Catálogo
              </Link>
              <Link className="btn btn-ghost" to="/inventory">
                Inventario
              </Link>
              <Link className="btn btn-ghost" to="/users">
                Usuarios
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
