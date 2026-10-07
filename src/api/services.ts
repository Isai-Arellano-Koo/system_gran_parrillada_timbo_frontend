import { apiRequest } from "./client";
import { loginBody } from "./loginBody";
import type {
  AuthResponse,
  Dish,
  Ingredient,
  InventoryMovement,
  KitchenTicket,
  Order,
  StockAlert,
  TableItem,
  User,
} from "../types";

export const usersApi = {
  list: (token: string) => apiRequest<User[]>("/api/users", { token }),
  get: (token: string, id: number) =>
    apiRequest<User>(`/api/users/${id}`, { token }),
  create: (
    token: string,
    body: {
      name: string;
      username: string;
      email: string;
      password: string;
      role: User["role"];
      is_active: boolean;
    }
  ) =>
    apiRequest<User>("/api/users", {
      method: "POST",
      token,
      body,
    }),
  update: (
    token: string,
    id: number,
    body: Partial<{
      name: string;
      username: string;
      email: string;
      password: string;
      role: User["role"];
      is_active: boolean;
    }>
  ) =>
    apiRequest<User>(`/api/users/${id}`, {
      method: "PATCH",
      token,
      body,
    }),
};

export const authApi = {
  login: (identifier: string, password: string) =>
    apiRequest<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: loginBody(identifier, password),
    }),
  me: (token: string) =>
    apiRequest<User>("/api/auth/me", { token }),
};

export const catalogApi = {
  listIngredients: (token: string) =>
    apiRequest<Ingredient[]>("/api/catalog/ingredients", { token }),
  createIngredient: (
    token: string,
    body: { name: string; unit: string; stock_minimum?: number }
  ) =>
    apiRequest<Ingredient>("/api/catalog/ingredients", {
      method: "POST",
      token,
      body,
    }),
  updateIngredient: (
    token: string,
    id: number,
    body: Partial<Ingredient>
  ) =>
    apiRequest<Ingredient>(`/api/catalog/ingredients/${id}`, {
      method: "PATCH",
      token,
      body,
    }),
  listDishes: (token: string, active = false) =>
    apiRequest<Dish[]>(
      `/api/catalog/dishes${active ? "?active=true" : ""}`,
      { token }
    ),
  createDish: (
    token: string,
    body: { name: string; price: number; description?: string }
  ) =>
    apiRequest<Dish>("/api/catalog/dishes", {
      method: "POST",
      token,
      body,
    }),
  updateDish: (token: string, id: number, body: Partial<Dish>) =>
    apiRequest<Dish>(`/api/catalog/dishes/${id}`, {
      method: "PATCH",
      token,
      body,
    }),
  setRecipe: (
    token: string,
    dishId: number,
    items: { ingredient_id: number; quantity: number }[]
  ) =>
    apiRequest<Dish>(`/api/catalog/dishes/${dishId}/recipe`, {
      method: "PUT",
      token,
      body: { items },
    }),
};

export const inventoryApi = {
  createEntry: (
    token: string,
    body: { ingredient_id: number; quantity: number; reason?: string }
  ) =>
    apiRequest("/api/inventory/entries", {
      method: "POST",
      token,
      body,
    }),
  adjustStock: (
    token: string,
    body: { ingredient_id: number; stock_current: number; reason?: string }
  ) =>
    apiRequest("/api/inventory/adjustments", {
      method: "POST",
      token,
      body,
    }),
  listMovements: (token: string) =>
    apiRequest<InventoryMovement[]>("/api/inventory/movements", { token }),
  listAlerts: (token: string) =>
    apiRequest<StockAlert[]>("/api/inventory/alerts", { token }),
};

export const ordersApi = {
  listTables: (token: string) =>
    apiRequest<TableItem[]>("/api/orders/tables", { token }),
  seedTables: (token: string) =>
    apiRequest<TableItem[]>("/api/orders/tables/seed", {
      method: "POST",
      token,
    }),
  list: (token: string) =>
    apiRequest<Order[]>("/api/orders", { token }),
  get: (token: string, orderId: number) =>
    apiRequest<Order>(`/api/orders/${orderId}`, { token }),
  open: (token: string, table_id: number) =>
    apiRequest<Order>("/api/orders", {
      method: "POST",
      token,
      body: { table_id },
    }),
  addDetail: (
    token: string,
    orderId: number,
    body: { dish_id: number; quantity: number; observation?: string }
  ) =>
    apiRequest<Order>(`/api/orders/${orderId}/details`, {
      method: "POST",
      token,
      body,
    }),
  removeDetail: (token: string, orderId: number, detailId: number) =>
    apiRequest<Order>(`/api/orders/${orderId}/details/${detailId}`, {
      method: "DELETE",
      token,
    }),
  validateStock: (token: string, orderId: number) =>
    apiRequest<{
      ok: boolean;
      shortages: Array<{
        name: string;
        needed: number;
        available: number;
        dishes: string[];
      }>;
    }>(`/api/orders/${orderId}/validate-stock`, {
      method: "POST",
      token,
    }),
  confirm: (token: string, orderId: number) =>
    apiRequest<Order>(`/api/orders/${orderId}/confirm`, {
      method: "POST",
      token,
    }),
  cancel: (token: string, orderId: number, reason: string) =>
    apiRequest<Order>(`/api/orders/${orderId}/cancel`, {
      method: "POST",
      token,
      body: { reason },
    }),
};

export const kitchenApi = {
  list: (token: string) =>
    apiRequest<KitchenTicket[]>("/api/kitchen", { token }),
  updateStatus: (
    token: string,
    ticketId: number,
    status: KitchenTicket["status"]
  ) =>
    apiRequest<KitchenTicket>(`/api/kitchen/${ticketId}/status`, {
      method: "PATCH",
      token,
      body: { status },
    }),
};
