export type UserRole = "admin" | "mesero" | "cocinero" | "cajero";

export type User = {
  id: number;
  name: string;
  username?: string | null;
  email: string;
  role: UserRole;
  is_active?: boolean;
  email_verified?: boolean;
};

export type UserStatusChange = {
  id: number;
  user_id: number;
  previous_is_active: boolean;
  next_is_active: boolean;
  reason: string;
  created_at?: string;
  user?: Pick<User, "id" | "name" | "username" | "email" | "role">;
  changed_by_user?: Pick<User, "id" | "name" | "username" | "email">;
};

export type AuthResponse = {
  accessToken: string;
  user: User;
};

export type PendingEmailConfirmation = {
  needsEmailConfirmation: true;
  confirmationToken: string;
  email: string;
  message: string;
};

export type LoginResponse = AuthResponse | PendingEmailConfirmation;

export type Ingredient = {
  id: number;
  name: string;
  unit: "kg" | "g" | "lt" | "ml" | "unidad";
  stock_current: number | string;
  stock_minimum: number | string;
  is_active: boolean;
};

export type RecipeItem = {
  id: number;
  dish_id: number;
  ingredient_id: number;
  quantity: number | string;
  ingredient?: Ingredient;
};

export type CategoryDish = {
  id: number;
  name: string;
  presentation?: string;
  is_active: boolean;
};

export type Category = {
  id: number;
  name: string;
  is_active: boolean;
  sort_order?: number;
  dishes?: CategoryDish[];
};

export type Dish = {
  id: number;
  category_id: number;
  name: string;
  presentation?: string;
  price: number | string;
  description?: string | null;
  is_active: boolean;
  category_disabled?: boolean;
  category?: Category;
  recipe_items?: RecipeItem[];
};

export function dishLabel(dish: {
  name: string;
  presentation?: string | null;
}) {
  const presentation = (dish.presentation || "").trim();
  return presentation ? `${dish.name} — ${presentation}` : dish.name;
}

export function orderCodeLabel(order: {
  id?: number;
  code: string;
  table_id?: number | null;
  table?: { number?: number } | null;
  created_at?: string;
}) {
  const code = order.code || "";
  if (/^(MESA |DEL-|LLEVAR-)/i.test(code)) return code;
  const mesa = code.match(/^M(\d{2})-\d{4}-(\d+)$/i);
  if (mesa) return `MESA ${Number(mesa[1])}-${Number(mesa[2])}`;
  const delivery = code.match(/^D-?\d{4}-(\d+)$/i);
  if (delivery) return `DEL-${Number(delivery[1])}`;
  return code || `Pedido ${order.id || ""}`;
}

export function tableNumbers(order?: {
  table_id?: number | null;
  table?: { number?: number } | null;
  tables?: { number?: number }[] | null;
} | null) {
  const numbers = (order?.tables || [])
    .map((table) => Number(table.number))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (numbers.length) {
    return [...new Set(numbers)].sort((a, b) => a - b);
  }
  const fallback = Number(order?.table?.number);
  return Number.isFinite(fallback) && fallback > 0 ? [fallback] : [];
}

export function tablesLabel(order?: Parameters<typeof tableNumbers>[0]) {
  const numbers = tableNumbers(order);
  if (!numbers.length) return "Mesa";
  const text = numbers.map((n) => String(n).padStart(2, "0")).join(" + ");
  return numbers.length === 1 ? `Mesa ${text}` : `Mesas ${text}`;
}

export function attentionLabel(modality?: string) {
  if (modality === "delivery") return "Delivery";
  if (modality === "para_llevar") return "Para llevar";
  return "Mesa";
}

export type TableItem = {
  id: number;
  number: number;
  capacity?: number | null;
  is_active: boolean;
  group_id?: number | null;
  group_numbers?: number[];
  occupied?: boolean;
  group_created_by?: number | null;
  can_ungroup?: boolean;
};

export type TableChange = {
  id: string;
  kind: "disponibilidad" | "agrupacion";
  at?: string | Date | null;
  table_number?: number | null;
  detail: string;
  reason?: string;
  user_name: string;
};

export type OrderDetail = {
  id: number;
  order_id: number;
  dish_id: number;
  quantity: number;
  unit_price: number | string;
  observation?: string | null;
  sent_to_kitchen?: boolean;
  kitchen_status?: "pendiente" | "en_preparacion" | "listo" | "entregado";
  charged?: boolean;
  return_kind?: "no_le_gusto" | "defecto" | null;
  return_note?: string | null;
  returned_at?: string | null;
  dish?: Dish;
};

export function kitchenStatusLabel(status?: string, modality?: string) {
  if (status === "pendiente") return "Pendiente";
  if (status === "en_preparacion") return "En preparación";
  if (status === "listo") {
    if (modality === "delivery") return "Listo para envío";
    if (modality === "para_llevar") return "Listo para recoger";
    return "Listo para servir";
  }
  if (status === "entregado") {
    return modality === "mesa" || !modality ? "En mesa" : "Entregado";
  }
  return status || "";
}

export type KitchenTicket = {
  id: number;
  order_id: number;
  status: "pendiente" | "en_preparacion" | "listo" | "entregado";
  status_changed_at?: string | null;
  created_at?: string;
  order?: Order;
};

export type AttentionModality = "mesa" | "delivery" | "para_llevar";

export type Order = {
  id: number;
  code: string;
  modality?: AttentionModality;
  table_id?: number | null;
  waiter_id: number;
  delivery_customer_name?: string | null;
  delivery_phone?: string | null;
  delivery_address?: string | null;
  delivery_note?: string | null;
  status: "en_edicion" | "confirmado" | "cerrado" | "cancelado";
  total: number | string;
  cancel_reason?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: number | null;
  cancelled_by_user?: User;
  cancellation?: {
    previous_status: string;
    previous_kitchen_status?: string | null;
    stock_action?: string;
    reason: string;
    created_at?: string;
    cancelled_by_user?: User;
  } | null;
  paid?: boolean;
  amount_paid?: number | string;
  paid_at?: string | null;
  confirmed_at?: string | null;
  closed_at?: string | null;
  created_at?: string;
  table?: TableItem | null;
  tables?: TableItem[];
  waiter?: User;
  details?: OrderDetail[];
  kitchen_ticket?: KitchenTicket | null;
  inventory_movements?: InventoryMovement[];
};

export type SoldDish = {
  id: number;
  dish_id: number;
  dish_name: string;
  presentation?: string;
  quantity: number;
  unit_price: number;
  total: number;
  order_id: number;
  order_code: string;
  modality: AttentionModality;
  table_number?: number | null;
  sold_at?: string | null;
};

export type InventoryMovement = {
  id: number;
  ingredient_id: number;
  type: string;
  quantity: number | string;
  reason?: string | null;
  order_id?: number | null;
  merma_review?: "pendiente" | "recuperada" | "descartada" | null;
  reviewed_at?: string | null;
  created_at?: string;
  ingredient?: Ingredient;
  user?: User;
  order?: {
    id: number;
    code: string;
    table_id: number;
    table?: { id: number; number: number };
  } | null;
};

export type StockAlert = {
  ingredient_id: number;
  name: string;
  unit: string;
  stock_current: number;
  stock_minimum: number;
};

export type WaiterNotification = {
  id: number;
  order_id: number;
  kitchen_ticket_id: number;
  order_detail_id?: number | null;
  waiter_id: number;
  order_code: string;
  table_label: string;
  dish_label?: string;
  generated_at: string;
  attended_at: string | null;
};

export type WaiterNotificationList = {
  pending: WaiterNotification[];
  history: WaiterNotification[];
  pending_count: number;
};
