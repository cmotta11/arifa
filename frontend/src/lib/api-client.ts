import { ENV } from "@/config/env";

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  params?: Record<string, string>;
};

let _guestToken: string | null = null;

export function setGuestToken(token: string | null) {
  _guestToken = token;
}

export function getGuestToken(): string | null {
  return _guestToken;
}

class ApiError extends Error {
  constructor(
    public status: number,
    public data: unknown
  ) {
    super(`API Error: ${status}`);
    this.name = "ApiError";
  }
}

function buildUrl(path: string, params?: Record<string, string>): string {
  const url = new URL(`${ENV.API_BASE_URL}${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }
  return url.toString();
}

function getCsrfToken(): string {
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match ? match[1] : "";
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, headers = {}, params } = options;

  const allHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "X-CSRFToken": getCsrfToken(),
    ...headers,
  };

  if (_guestToken) {
    allHeaders["X-Guest-Token"] = _guestToken;
  }

  const config: RequestInit = {
    method,
    credentials: "include",
    headers: allHeaders,
  };

  if (body && method !== "GET") {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(buildUrl(path, params), config);

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(response.status, data);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

async function uploadFile<T>(path: string, formData: FormData): Promise<T> {
  const uploadHeaders: Record<string, string> = {
    "X-CSRFToken": getCsrfToken(),
  };
  if (_guestToken) {
    uploadHeaders["X-Guest-Token"] = _guestToken;
  }

  const response = await fetch(buildUrl(path), {
    method: "POST",
    credentials: "include",
    headers: uploadHeaders,
    body: formData,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(response.status, data);
  }

  return response.json();
}

export const api = {
  get: <T>(path: string, params?: Record<string, string>) =>
    request<T>(path, { params }),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body }),

  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body }),

  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body }),

  delete: <T>(path: string) =>
    request<T>(path, { method: "DELETE" }),

  upload: <T>(path: string, formData: FormData) =>
    uploadFile<T>(path, formData),
};

export { ApiError };
