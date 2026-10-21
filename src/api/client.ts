const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
// En local apunta al backend. En Railway se cambia con VITE_API_URL

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
};

export class ApiError extends Error {
  status: number;
  payload: Record<string, unknown>;

  constructor(
    message: string,
    status: number,
    payload: Record<string, unknown> = {}
  ) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(
      data.message || "Error en la solicitud",
      response.status,
      data as Record<string, unknown>
    );
  }

  return data as T;
}

export { API_URL };
