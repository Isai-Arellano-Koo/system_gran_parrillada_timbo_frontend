import { Link } from "react-router-dom";
import type { UserStatusChange } from "../types";
import { formatDateTime } from "../helpers/datetime";

function personLabel(person?: {
  name: string;
  username?: string | null;
  email?: string;
}) {
  if (!person) return "—";
  return person.username ? `${person.name} (${person.username})` : person.name;
}

export function UserStatusHistory({
  changes,
  showUser = false,
}: {
  changes: UserStatusChange[];
  showUser?: boolean;
}) {
  if (changes.length === 0) {
    return (
      <div className="empty">
        Aún no hay cambios de estado registrados para este usuario.
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {showUser ? <th>Usuario</th> : null}
            <th>Cambio</th>
            <th>Motivo</th>
            <th>Fecha y hora</th>
            <th>Quién lo cambió</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((item) => (
            <tr key={item.id}>
              {showUser ? (
                <td>
                  {item.user ? (
                    <Link to={`/users/${item.user.id}`}>
                      <strong>{item.user.name}</strong>
                    </Link>
                  ) : (
                    "—"
                  )}
                  {item.user?.username ? (
                    <div className="hint">{item.user.username}</div>
                  ) : null}
                </td>
              ) : null}
              <td>
                <span
                  className={`badge ${item.next_is_active ? "badge-ok" : "badge-danger"}`}
                >
                  {item.previous_is_active ? "Activo" : "Inactivo"} →{" "}
                  {item.next_is_active ? "Activo" : "Inactivo"}
                </span>
              </td>
              <td>{item.reason}</td>
              <td>{formatDateTime(item.created_at)}</td>
              <td>
                <strong>{personLabel(item.changed_by_user)}</strong>
                {item.changed_by_user?.email ? (
                  <div className="hint">{item.changed_by_user.email}</div>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
