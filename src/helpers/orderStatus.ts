import type { Order } from "../types";

export type OrderTone =
  | "free"
  | "editing"
  | "kitchen"
  | "cooking"
  | "ready"
  | "dining"
  | "closed"
  | "cancelled";

export const ORDER_TONES: { tone: OrderTone; label: string }[] = [
  { tone: "free", label: "Libre" },
  { tone: "editing", label: "En edición" },
  { tone: "kitchen", label: "En cocina" },
  { tone: "cooking", label: "En preparación" },
  { tone: "ready", label: "Listo" },
  { tone: "dining", label: "En mesa" },
  { tone: "closed", label: "Cerrado" },
  { tone: "cancelled", label: "Cancelado" },
];

export const KITCHEN_TONES: { tone: OrderTone; label: string }[] = [
  { tone: "kitchen", label: "Pendiente" },
  { tone: "cooking", label: "En preparación" },
  { tone: "ready", label: "Listo" },
  { tone: "dining", label: "En mesa / entregado" },
];

export function dueOf(order?: Order | null) {
  if (!order) return 0;
  return Math.max(0, Number(order.total) - Number(order.amount_paid || 0));
}

export function isUnpaid(order?: Order | null) {
  return Boolean(
    order &&
      order.status === "confirmado" &&
      dueOf(order) > 0.009
  );
}

export function kitchenTone(status?: string | null): OrderTone {
  if (status === "en_preparacion") return "cooking";
  if (status === "listo") return "ready";
  if (status === "entregado") return "dining";
  return "kitchen";
}

export function orderTone(order?: Order | null): OrderTone {
  if (!order) return "free";
  if (order.status === "cancelado") return "cancelled";
  if (order.status === "cerrado") return "closed";
  if (order.status === "en_edicion") return "editing";
  return kitchenTone(order.kitchen_ticket?.status);
}

export function orderToneLabel(tone: OrderTone, modality?: string) {
  if (tone === "free") return "Libre";
  if (tone === "editing") return "En edición";
  if (tone === "kitchen") return "En cocina";
  if (tone === "cooking") return "En preparación";
  if (tone === "ready") {
    if (modality === "delivery") return "Listo para envío";
    if (modality === "para_llevar") return "Listo para recoger";
    return "Listo para servir";
  }
  if (tone === "dining") {
    return modality === "mesa" || !modality ? "En mesa" : "Entregado";
  }
  if (tone === "closed") return "Cerrado";
  return "Cancelado";
}

export function toneClass(tone: OrderTone, unpaid = false) {
  return `st st-${tone}${unpaid ? " st-unpaid" : ""}`;
}
