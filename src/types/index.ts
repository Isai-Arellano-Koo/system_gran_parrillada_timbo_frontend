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
  if (/^D-?\d{4}-\d+$/i.test(order.code)) return order.code;
  if (/^M\d{2}-\d{4}-\d+$/i.test(order.code)) return order.code;
  const table = String(order.table?.number ?? order.table_id).padStart(2, "0");
  const date = order.created_at ? new Date(order.created_at) : null;
  const ddmm =
    date && !Number.isNaN(date.getTime())
      ? `${String(date.getDate()).padStart(2, "0")}${String(
          date.getMonth() + 1
        ).padStart(2, "0")}`
      : "";
  const tail = order.code.match(/(\d{2,3})$/)?.[1] || String(order.id || "");
  return ddmm ? `M${table}-${ddmm}-${tail}` : `M${table}-${tail}`;
}

export type TableItem = {
  id: number;
  number: number;
  capacity?: number | null;
  is_active: boolean;
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
  dish?: Dish;
};

export function kitchenStatusLabel(status?: string, modality?: string) {
  if (status === "pendiente") return "Pendiente";
  if (status === "en_preparacion") return "En preparación";
  if (status === "listo") return "Listo para servir";
  if (status === "entregado") return modality === "delivery" ? "Entregado" : "En mesa";
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

export type AttentionModality = "mesa" | "delivery";

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
  paid?: boolean;
  amount_paid?: number | string;
  paid_at?: string | null;
  confirmed_at?: string | null;
  closed_at?: string | null;
  created_at?: string;
  table?: TableItem | null;
  waiter?: User;
  details?: OrderDetail[];
  kitchen_ticket?: KitchenTicket | null;
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
