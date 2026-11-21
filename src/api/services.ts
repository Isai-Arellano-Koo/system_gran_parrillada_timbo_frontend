import { apiRequest } from "./client";
import { loginBody } from "./loginBody";
import type {
  LoginResponse,
  AuthResponse,
  Category,
  Dish,
  Ingredient,
  InventoryMovement,
  KitchenTicket,
  Order,
  OrdersHistoryResponse,
  SoldDish,
  StockAlert,
  TableChange,
  TableItem,
  User,
  UserStatusChange,
  WaiterNotification,
  WaiterNotificationList,
} from "../types";

// Llamadas al backend agrupadas por módulo
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
      status_reason: string;
    }>
  ) =>
    apiRequest<User>(`/api/users/${id}`, {
      method: "PATCH",
      token,
      body,
    }),
  statusChanges: (token: string, id?: number) =>
    apiRequest<UserStatusChange[]>(
      id ? `/api/users/${id}/status-changes` : "/api/users/status-changes",
      { token }
    ),
};

export const authApi = {
  login: (identifier: string, password: string) =>
    apiRequest<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: loginBody(identifier, password),
    }),
  confirmEmail: (confirmationToken: string, code: string) =>
    apiRequest<AuthResponse>("/api/auth/confirm-email", {
      method: "POST",
      body: { confirmationToken, code },
    }),
  resendConfirmEmail: (confirmationToken: string) =>
    apiRequest<{ message: string }>("/api/auth/confirm-email/resend", {
      method: "POST",
      body: { confirmationToken },
    }),
  requestPasswordReset: (identifier: string) =>
    apiRequest<{ message: string; emailHint?: string }>(
      "/api/auth/password-reset",
      {
        method: "POST",
        body: loginBody(identifier, "-"),
      }
    ),
  confirmPasswordReset: (identifier: string, code: string, password: string) =>
    apiRequest<{ message: string }>("/api/auth/password-reset/confirm", {
      method: "POST",
      body: { ...loginBody(identifier, password), code },
    }),
  me: (token: string) =>
    apiRequest<User>("/api/auth/me", { token }),
};

export const catalogApi = {
  listCategories: (token: string, active = false) =>
    apiRequest<Category[]>(
      `/api/catalog/categories${active ? "?active=true" : ""}`,
      { token }
    ),
  createCategory: (token: string, body: { name: string }) =>
    apiRequest<Category>("/api/catalog/categories", {
      method: "POST",
      token,
      body,
    }),
  updateCategory: (
    token: string,
    id: number,
    body: Partial<{ name: string; is_active: boolean }>
  ) =>
    apiRequest<Category>(`/api/catalog/categories/${id}`, {
      method: "PATCH",
      token,
      body,
    }),
  removeCategory: (token: string, id: number) =>
    apiRequest<Category>(`/api/catalog/categories/${id}`, {
      method: "DELETE",
      token,
    }),
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
    body: Partial<{
      name: string;
      unit: string;
      stock_minimum: number;
      is_active: boolean;
    }>
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
    body: {
      name: string;
      presentation?: string;
      price: number;
      description?: string;
      category_id: number;
      is_active?: boolean;
    }
  ) =>
    apiRequest<Dish>("/api/catalog/dishes", {
      method: "POST",
      token,
      body,
    }),
  updateDish: (
    token: string,
    id: number,
    body: Partial<{
      name: string;
      presentation: string;
      price: number;
      description: string;
      category_id: number;
      is_active: boolean;
      status_reason: string;
    }>
  ) =>
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
  listMovements: (
    token: string,
    filters?: {
      ingredient_id?: number | string;
      type?: string;
      user_id?: number | string;
      from?: string;
      to?: string;
    }
  ) => {
    const query = new URLSearchParams();
    if (filters?.ingredient_id) query.set("ingredient_id", String(filters.ingredient_id));
    if (filters?.type) query.set("type", filters.type);
    if (filters?.user_id) query.set("user_id", String(filters.user_id));
    if (filters?.from) query.set("from", filters.from);
    if (filters?.to) query.set("to", filters.to);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return apiRequest<InventoryMovement[]>(`/api/inventory/movements${suffix}`, {
      token,
    });
  },
  listAlerts: (token: string) =>
    apiRequest<StockAlert[]>("/api/inventory/alerts", { token }),
  reviewMerma: (
    token: string,
    movementId: number,
    action: "recuperar" | "descartar"
  ) =>
    apiRequest<InventoryMovement>(`/api/inventory/movements/${movementId}/review`, {
      method: "POST",
      token,
      body: { action },
    }),
};

export const ordersApi = {
  listTables: (token: string) =>
    apiRequest<TableItem[]>("/api/orders/tables", { token }),
  setTableActive: (
    token: string,
    tableId: number,
    is_active: boolean,
    reason: string
  ) =>
    apiRequest<TableItem>(`/api/orders/tables/${tableId}`, {
      method: "PATCH",
      token,
      body: { is_active, reason },
    }),
  groupTables: (token: string, table_ids: number[]) =>
    apiRequest<TableItem[]>("/api/orders/tables/groups", {
      method: "POST",
      token,
      body: { table_ids },
    }),
  ungroupTables: (token: string, groupId: number) =>
    apiRequest<TableItem[]>(`/api/orders/tables/groups/${groupId}`, {
      method: "DELETE",
      token,
    }),
  tableChanges: (token: string) =>
    apiRequest<TableChange[]>("/api/orders/tables/changes", {
      token,
    }),
  seedTables: (token: string) =>
    apiRequest<TableItem[]>("/api/orders/tables/seed", {
      method: "POST",
      token,
    }),
  list: (token: string, modality?: "mesa" | "delivery" | "para_llevar" | "offsite") =>
    apiRequest<Order[]>(
      modality ? `/api/orders?modality=${modality}` : "/api/orders",
      { token }
    ),
  history: (
    token: string,
    params: {
      date?: string;
      from?: string;
      to?: string;
      status?: string;
      modality?: "mesa" | "delivery" | "para_llevar";
    }
  ) => {
    const query = new URLSearchParams();
    if (params.date) query.set("date", params.date);
    if (params.from) query.set("from", params.from);
    if (params.to) query.set("to", params.to);
    if (params.status && params.status !== "all") {
      query.set("status", params.status);
    }
    if (params.modality) query.set("modality", params.modality);
    const suffix = query.toString();
    return apiRequest<OrdersHistoryResponse>(
      `/api/orders/history${suffix ? `?${suffix}` : ""}`,
      { token }
    );
  },
  soldDishes: (token: string) =>
    apiRequest<SoldDish[]>("/api/orders/sales", { token }),
  get: (token: string, orderId: number) =>
    apiRequest<Order>(`/api/orders/${orderId}`, { token }),
  open: (token: string, table_id: number) =>
    apiRequest<Order>("/api/orders", {
      method: "POST",
      token,
      body: { table_id, modality: "mesa" },
    }),
  joinTables: (token: string, from_table_id: number, to_table_id: number) =>
    apiRequest<Order>("/api/orders/join-tables", {
      method: "POST",
      token,
      body: { from_table_id, to_table_id },
    }),
  splitTable: (token: string, table_id: number) =>
    apiRequest<TableItem[]>("/api/orders/split-table", {
      method: "POST",
      token,
      body: { table_id },
    }),
  openDelivery: (
    token: string,
    body: {
      modality: "delivery" | "para_llevar";
      delivery_customer_name: string;
      delivery_phone?: string;
      delivery_address?: string;
      delivery_note?: string;
    }
  ) =>
    apiRequest<Order>("/api/orders", {
      method: "POST",
      token,
      body,
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
  updateDetail: (
    token: string,
    orderId: number,
    detailId: number,
    body: { quantity?: number; observation?: string }
  ) =>
    apiRequest<Order>(`/api/orders/${orderId}/details/${detailId}`, {
      method: "PATCH",
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
  sendAdditions: (token: string, orderId: number) =>
    apiRequest<Order>(`/api/orders/${orderId}/additions`, {
      method: "POST",
      token,
    }),
  setPaid: (token: string, orderId: number, paid: boolean) =>
    apiRequest<Order>(`/api/orders/${orderId}/paid`, {
      method: "PATCH",
      token,
      body: { paid },
    }),
  close: (token: string, orderId: number) =>
    apiRequest<Order>(`/api/orders/${orderId}/close`, {
      method: "POST",
      token,
    }),
  cancel: (token: string, orderId: number, reason: string) =>
    apiRequest<Order>(`/api/orders/${orderId}/cancel`, {
      method: "POST",
      token,
      body: { reason },
    }),
  returnDetail: (
    token: string,
    orderId: number,
    detailId: number,
    body: { kind: "no_le_gusto" | "defecto"; note?: string }
  ) =>
    apiRequest<Order>(
      `/api/orders/${orderId}/details/${detailId}/return`,
      { method: "POST", token, body }
    ),
};

export const notificationsApi = {
  list: (token: string) =>
    apiRequest<WaiterNotificationList>("/api/notifications", { token }),
  attend: (token: string, notificationId: number) =>
    apiRequest<WaiterNotification>(
      `/api/notifications/${notificationId}/attend`,
      { method: "PATCH", token }
    ),
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
  updateDishStatus: (
    token: string,
    detailId: number,
    status: KitchenTicket["status"]
  ) =>
    apiRequest<KitchenTicket>(`/api/kitchen/details/${detailId}/status`, {
      method: "PATCH",
      token,
      body: { status },
    }),
};
