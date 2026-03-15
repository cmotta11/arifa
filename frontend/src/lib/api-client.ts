import { ENV } from "@/config/env";

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  params?: Record<string, string>;
};

// --- Guest token ---
let _guestToken: string | null = null;

export function setGuestToken(token: string | null) {
  _guestToken = token;
}

export function getGuestToken(): string | null {
  return _guestToken;
}

// --- JWT token management (in-memory only, not localStorage) ---
let _accessToken: string | null = null;
let _refreshToken: string | null = null;
let _refreshPromise: Promise<boolean> | null = null;

// --- Auth failure callback (set by AuthProvider) ---
let _onAuthFailure: (() => void) | null = null;

export function setOnAuthFailure(callback: (() => void) | null) {
  _onAuthFailure = callback;
}

export function setTokens(access: string | null, refresh: string | null) {
  _accessToken = access;
  _refreshToken = refresh;
}

export function getAccessToken(): string | null {
  return _accessToken;
}

export function clearTokens() {
  _accessToken = null;
  _refreshToken = null;
}

async function refreshAccessToken(): Promise<boolean> {
  if (!_refreshToken) return false;

  // Deduplicate concurrent refresh calls
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    try {
      const url = buildUrl("/auth/token/refresh/");
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ refresh: _refreshToken }),
      });

      if (!response.ok) {
        clearTokens();
        _onAuthFailure?.();
        return false;
      }

      const data = await response.json();
      _accessToken = data.access;
      if (data.refresh) {
        _refreshToken = data.refresh;
      }
      return true;
    } catch {
      clearTokens();
      _onAuthFailure?.();
      return false;
    } finally {
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

class ApiError extends Error {
  constructor(
    public status: number,
    public data: Record<string, unknown> | null
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

function buildAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};

  if (_accessToken) {
    headers["Authorization"] = `Bearer ${_accessToken}`;
  } else {
    headers["X-CSRFToken"] = getCsrfToken();
  }

  if (_guestToken) {
    headers["X-Guest-Token"] = _guestToken;
  }

  return headers;
}

function buildHeaders(headers: Record<string, string>): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...buildAuthHeaders(),
    ...headers,
  };
}

/**
 * Shared fetch wrapper with automatic 401 retry via token refresh.
 */
async function fetchWithRetry(
  url: string,
  config: RequestInit,
  retry: boolean,
): Promise<Response> {
  const response = await fetch(url, config);

  if (response.status === 401 && retry && _refreshToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      // Rebuild auth headers with the new token
      const retryHeaders = new Headers(config.headers);
      const newAuth = buildAuthHeaders();
      for (const [key, value] of Object.entries(newAuth)) {
        retryHeaders.set(key, value);
      }
      return fetch(url, { ...config, headers: retryHeaders });
    }
  }

  return response;
}

async function request<T>(path: string, options: RequestOptions = {}, retry = true): Promise<T> {
  const { method = "GET", body, headers = {}, params } = options;

  const config: RequestInit = {
    method,
    credentials: "include",
    headers: buildHeaders(headers),
  };

  if (body && method !== "GET") {
    config.body = JSON.stringify(body);
  }

  const response = await fetchWithRetry(buildUrl(path, params), config, retry);

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(response.status, data);
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return response.json();
}

async function uploadFile<T>(path: string, formData: FormData, retry = true): Promise<T> {
  const config: RequestInit = {
    method: "POST",
    credentials: "include",
    headers: buildAuthHeaders(),
    body: formData,
  };

  const response = await fetchWithRetry(buildUrl(path), config, retry);

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(response.status, data);
  }

  return response.json();
}

async function blob(path: string, params?: Record<string, string>): Promise<Blob> {
  const config: RequestInit = {
    method: "GET",
    credentials: "include",
    headers: buildAuthHeaders(),
  };

  const response = await fetchWithRetry(buildUrl(path, params), config, true);

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(response.status, data);
  }

  return response.blob();
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

  blob: (path: string, params?: Record<string, string>) =>
    blob(path, params),
};

export { ApiError };
