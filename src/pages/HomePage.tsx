import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { inventoryApi, kitchenApi, ordersApi } from "../api/services";

function firstName(name: string) {
  return name.trim().split(" ")[0] || name;
}

function leadFor(role: string | undefined) {
  if (role === "mesero") return "Abrí el pedido de la mesa y mandalo a cocina.";
  if (role === "cocinero") return "Las comandas del salón salen acá, en orden.";
  if (role === "cajero") return "Pedidos y cocina los atienden mesero y parrilla.";
  return "Lo que hay abierto en el salón y en la parrilla.";
}

export function HomePage() {
  const { token, user } = useAuth();
  const [orders, setOrders] = useState(0);
  const [tickets, setTickets] = useState(0);
  const [alerts, setAlerts] = useState(0);
  const showFloor = user?.role !== "cajero";

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

  const primary =
    user?.role === "mesero" || user?.role === "admin" ? (
      <Link className="btn btn-primary" to="/orders">
        Tomar un pedido
      </Link>
    ) : user?.role === "cocinero" ? (
      <Link className="btn btn-primary" to="/kitchen">
        Ir a cocina
      </Link>
    ) : null;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Hola, {firstName(user?.name || "")}</h1>
          <p>{leadFor(user?.role)}</p>
        </div>
        {primary}
      </div>

      {showFloor ? (
        <section className="panel">
          <div className="list-head">
            <h2>En el local ahora</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Qué</th>
                  <th>Cantidad</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Mesas con pedido</td>
                  <td>{orders}</td>
                  <td>
                    {user?.role === "mesero" || user?.role === "admin" ? (
                      <Link to="/orders">Ver pedidos</Link>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
                <tr>
                  <td>Comandas en la parrilla</td>
                  <td>{tickets}</td>
                  <td>
                    <Link to="/kitchen">Ver cocina</Link>
                  </td>
                </tr>
                {user?.role === "admin" ? (
                  <tr>
                    <td>Ingredientes por reponer</td>
                    <td>{alerts}</td>
                    <td>
                      <Link to="/inventory">Ver despensa</Link>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
