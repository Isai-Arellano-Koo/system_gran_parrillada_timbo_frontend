import type { Order, OrderDetail } from "../types";
import { kitchenStatusLabel } from "../types";

export type DishReturnKind = "no_le_gusto" | "defecto";

export function canCancelOrder(order: Order) {
  if (order.status !== "en_edicion" && order.status !== "confirmado") {
    return false;
  }
  return order.kitchen_ticket?.status !== "entregado";
}

export function cancelStockHint(order: Order) {
  const kitchen = order.kitchen_ticket?.status;
  if (order.status === "en_edicion" || !kitchen) {
    return "El pedido aún no descontó ingredientes.";
  }
  if (kitchen === "pendiente" || kitchen === "en_preparacion" || kitchen === "listo") {
    return "Los ingredientes quedan como merma. Administración decide después si alguno puede volver al stock.";
  }
  return "La comanda ya salió a mesa. No se puede cancelar el pedido.";
}

export function returnKindLabel(kind?: string | null) {
  if (kind === "defecto") return "Defecto · no se cobra";
  if (kind === "no_le_gusto") return "No le gustó · se cobra";
  return "";
}

export function CancelOrderBox({
  order,
  reason,
  onReason,
  busy,
  onConfirm,
  onClose,
}: {
  order: Order;
  reason: string;
  onReason: (value: string) => void;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const allowed = canCancelOrder(order);
  return (
    <div className="pos-cancel">
      <p className="muted">{cancelStockHint(order)}</p>
      {allowed ? (
        <>
          <input
            value={reason}
            onChange={(e) => onReason(e.target.value)}
            placeholder="Motivo de cancelación (obligatorio)"
          />
          <div className="actions">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={onClose}
            >
              Volver
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={busy || reason.trim().length < 3}
              onClick={onConfirm}
            >
              Confirmar cancelación
            </button>
          </div>
        </>
      ) : (
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Entendido
        </button>
      )}
    </div>
  );
}

export function ReturnDishBox({
  detail,
  kind,
  note,
  onKind,
  onNote,
  busy,
  onConfirm,
  onClose,
}: {
  detail: OrderDetail;
  kind: DishReturnKind;
  note: string;
  onKind: (value: DishReturnKind) => void;
  onNote: (value: string) => void;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="pos-cancel">
      <p className="muted">
        {detail.dish?.name || "Este plato"} ·{" "}
        {kitchenStatusLabel(detail.kitchen_status)}
        . Los ingredientes quedan como merma para que administración los revise.
      </p>
      <label className="return-option">
        <input
          type="radio"
          name={`return-${detail.id}`}
          checked={kind === "no_le_gusto"}
          onChange={() => onKind("no_le_gusto")}
        />
        <span>
          <strong>No le gustó</strong>
          <em>Se cobra igual. Si quieren otro, agrégalo de nuevo.</em>
        </span>
      </label>
      <label className="return-option">
        <input
          type="radio"
          name={`return-${detail.id}`}
          checked={kind === "defecto"}
          onChange={() => onKind("defecto")}
        />
        <span>
          <strong>Salió con defecto</strong>
          <em>No se cobra. Si lo cambias, agrégalo otra vez al ticket.</em>
        </span>
      </label>
      <input
        value={note}
        onChange={(e) => onNote(e.target.value)}
        placeholder="Nota (opcional)"
      />
      <div className="actions">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy}
          onClick={onClose}
        >
          Volver
        </button>
        <button
          type="button"
          className="btn btn-danger"
          disabled={busy}
          onClick={onConfirm}
        >
          Registrar
        </button>
      </div>
    </div>
  );
}
