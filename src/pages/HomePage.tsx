import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { inventoryApi, kitchenApi, ordersApi } from "../api/services";

function firstName(name: string) {
  return name.trim().split(" ")[0] || name;
}

function greeting(role: string | undefined, name: string) {
  const who = firstName(name);
  if (role === "mesero") {
    return {
      title: `Hola, ${who}`,
      lead: "Cuando una mesa pida, abre el pedido acá y mándalo a la parrilla.",
    };
  }
  if (role === "cocinero") {
    return {
      title: `Hola, ${who}`,
      lead: "Las comandas que llegan del salón aparecen en Cocina.",
    };
  }
  if (role === "cajero") {
    return {
      title: `Hola, ${who}`,
      lead: "Desde acá no se toman pedidos. Mesero y cocina atienden el salón.",
    };
  }
  return {
    title: `Hola, ${who}`,
    lead: "Pedidos abiertos, lo que está en la parrilla y si falta algún ingrediente.",
  };
}

export function HomePage() {
  const { token, user } = useAuth();
  const [orders, setOrders] = useState(0);
  const [tickets, setTickets] = useState(0);
  const [alerts, setAlerts] = useState(0);
  const copy = greeting(user?.role, user?.name || "");
  const showNumbers = user?.role !== "cajero";

  useEffect(() => {
    if (!token || user?.role === "cajero") return;
    const load = async () => {
      try {
        const [orderList, ticketList] = await Promise.all([
          ordersApi.list(token),
          kitchenApi.list(token),
        ]);
        setOrders(orderList.filter((o) => o.status !== "cancelado").length);
        setTickets(ticketList.filter((t) => t.status !== "entregado").length);
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
          <h1>{copy.title}</h1>
          <p>{copy.lead}</p>
        </div>
      </div>

      {showNumbers ? (
        <div className={user?.role === "admin" ? "grid-3" : "grid-2"}>
          <div className="stat">
            <span>Mesas con pedido</span>
            <strong>{orders}</strong>
          </div>
          <div className="stat">
            <span>En la parrilla</span>
            <strong>{tickets}</strong>
          </div>
          {user?.role === "admin" ? (
            <div className="stat">
              <span>Ingredientes por reponer</span>
              <strong>{alerts}</strong>
            </div>
          ) : null}
        </div>
      ) : null}

      {user?.role !== "cajero" ? (
        <div className="panel" style={{ marginTop: "1rem" }}>
          <h2>Qué puedes hacer</h2>
          <div className="actions">
            {(user?.role === "mesero" || user?.role === "admin") && (
              <Link className="btn btn-primary" to="/orders">
                Tomar un pedido
              </Link>
            )}
            {(user?.role === "cocinero" || user?.role === "admin") && (
              <Link className="btn btn-ghost" to="/kitchen">
                Ver la parrilla
              </Link>
            )}
            {user?.role === "mesero" && (
              <Link className="btn btn-ghost" to="/kitchen">
                Ver comandas
              </Link>
            )}
            {user?.role === "admin" && (
              <>
                <Link className="btn btn-ghost" to="/dishes">
                  Carta
                </Link>
                <Link className="btn btn-ghost" to="/inventory">
                  Despensa
                </Link>
                <Link className="btn btn-ghost" to="/users">
                  Equipo
                </Link>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
