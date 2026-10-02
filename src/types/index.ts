export type UserRole = "admin" | "mesero" | "cocinero";

export type User = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
};

export type AuthResponse = {
  accessToken: string;
  user: User;
};

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

export type Dish = {
  id: number;
  name: string;
  price: number | string;
  description?: string | null;
  is_active: boolean;
  recipe_items?: RecipeItem[];
};

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
  dish?: Dish;
};

export type KitchenTicket = {
  id: number;
  order_id: number;
  status: "pendiente" | "en_preparacion" | "listo" | "entregado";
  status_changed_at?: string | null;
  order?: Order;
};

export type Order = {
  id: number;
  code: string;
  table_id: number;
  waiter_id: number;
  status: "en_edicion" | "confirmado" | "cancelado";
  total: number | string;
  cancel_reason?: string | null;
  confirmed_at?: string | null;
  table?: TableItem;
  waiter?: User;
  details?: OrderDetail[];
  kitchen_ticket?: KitchenTicket | null;
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
};

export type StockAlert = {
  ingredient_id: number;
  name: string;
  unit: string;
  stock_current: number;
  stock_minimum: number;
};
