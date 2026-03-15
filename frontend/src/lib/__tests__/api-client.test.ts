import {
  api,
  ApiError,
  setTokens,
  getAccessToken,
  clearTokens,
  setGuestToken,
  getGuestToken,
  setOnAuthFailure,
} from "../api-client";

// Mock the ENV module
vi.mock("@/config/env", () => ({
  ENV: {
    API_BASE_URL: "/api/v1",
    IS_DEV: false,
  },
}));

function mockFetch(response: Partial<Response> & { json?: () => Promise<unknown>; blob?: () => Promise<Blob> }) {
  const defaultResponse: Response = {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: new Headers(),
    redirected: false,
    type: "basic" as ResponseType,
    url: "",
    body: null,
    bodyUsed: false,
    clone: vi.fn(),
    arrayBuffer: vi.fn(),
    formData: vi.fn(),
    text: vi.fn(),
    json: () => Promise.resolve({}),
    blob: () => Promise.resolve(new Blob()),
    ...response,
  };
  return vi.fn().mockResolvedValue(defaultResponse);
}

function mockFetchSequence(responses: Array<Partial<Response> & { json?: () => Promise<unknown> }>) {
  const fn = vi.fn();
  responses.forEach((response) => {
    const defaultResponse: Response = {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers(),
      redirected: false,
      type: "basic" as ResponseType,
      url: "",
      body: null,
      bodyUsed: false,
      clone: vi.fn(),
      arrayBuffer: vi.fn(),
      formData: vi.fn(),
      text: vi.fn(),
      json: () => Promise.resolve({}),
      blob: () => Promise.resolve(new Blob()),
      ...response,
    };
    fn.mockResolvedValueOnce(defaultResponse);
  });
  return fn;
}

describe("api-client", () => {
  beforeEach(() => {
    setTokens(null, null);
    setGuestToken(null);
    setOnAuthFailure(null);
    // Reset document.cookie
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("setTokens / getAccessToken / clearTokens", () => {
    it("stores and retrieves access token", () => {
      setTokens("access123", "refresh456");
      expect(getAccessToken()).toBe("access123");
    });

    it("clears tokens", () => {
      setTokens("access123", "refresh456");
      clearTokens();
      expect(getAccessToken()).toBeNull();
    });

    it("returns null when no tokens are set", () => {
      expect(getAccessToken()).toBeNull();
    });
  });

  describe("setGuestToken / getGuestToken", () => {
    it("stores and retrieves guest token", () => {
      setGuestToken("guest-abc");
      expect(getGuestToken()).toBe("guest-abc");
    });

    it("clears guest token with null", () => {
      setGuestToken("guest-abc");
      setGuestToken(null);
      expect(getGuestToken()).toBeNull();
    });
  });

  describe("ApiError", () => {
    it("has correct status and data properties", () => {
      const error = new ApiError(404, { detail: "Not found" });
      expect(error.status).toBe(404);
      expect(error.data).toEqual({ detail: "Not found" });
      expect(error.name).toBe("ApiError");
      expect(error.message).toBe("API Error: 404");
    });

    it("handles null data", () => {
      const error = new ApiError(500, null);
      expect(error.status).toBe(500);
      expect(error.data).toBeNull();
    });

    it("is an instance of Error", () => {
      const error = new ApiError(400, {});
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe("auth headers", () => {
    it("includes Bearer token when JWT is set", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ result: "ok" }),
      });
      vi.stubGlobal("fetch", fetchMock);

      setTokens("my-jwt", "my-refresh");
      await api.get("/test/");

      const callArgs = fetchMock.mock.calls[0];
      const headers = callArgs[1].headers;
      expect(headers["Authorization"]).toBe("Bearer my-jwt");
    });

    it("includes CSRF token when no JWT is set", async () => {
      Object.defineProperty(document, "cookie", {
        writable: true,
        value: "csrftoken=csrf123; other=value",
      });

      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ result: "ok" }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await api.get("/test/");

      const callArgs = fetchMock.mock.calls[0];
      const headers = callArgs[1].headers;
      expect(headers["X-CSRFToken"]).toBe("csrf123");
      expect(headers["Authorization"]).toBeUndefined();
    });

    it("includes guest token when set", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ result: "ok" }),
      });
      vi.stubGlobal("fetch", fetchMock);

      setGuestToken("guest-xyz");
      await api.get("/test/");

      const callArgs = fetchMock.mock.calls[0];
      const headers = callArgs[1].headers;
      expect(headers["X-Guest-Token"]).toBe("guest-xyz");
    });

    it("includes both Bearer and guest token when both are set", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ result: "ok" }),
      });
      vi.stubGlobal("fetch", fetchMock);

      setTokens("my-jwt", "my-refresh");
      setGuestToken("guest-xyz");
      await api.get("/test/");

      const callArgs = fetchMock.mock.calls[0];
      const headers = callArgs[1].headers;
      expect(headers["Authorization"]).toBe("Bearer my-jwt");
      expect(headers["X-Guest-Token"]).toBe("guest-xyz");
    });
  });

  describe("successful requests", () => {
    it("api.get sends GET request and returns JSON", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 1, name: "Test" }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const result = await api.get("/items/");
      expect(result).toEqual({ id: 1, name: "Test" });
      expect(fetchMock.mock.calls[0][1].method).toBe("GET");
    });

    it("api.post sends POST request with body", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ id: 2 }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const result = await api.post("/items/", { name: "New" });
      expect(result).toEqual({ id: 2 });

      const callArgs = fetchMock.mock.calls[0];
      expect(callArgs[1].method).toBe("POST");
      expect(callArgs[1].body).toBe(JSON.stringify({ name: "New" }));
    });

    it("api.put sends PUT request", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ updated: true }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await api.put("/items/1/", { name: "Updated" });
      expect(fetchMock.mock.calls[0][1].method).toBe("PUT");
    });

    it("api.patch sends PATCH request", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ updated: true }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await api.patch("/items/1/", { name: "Patched" });
      expect(fetchMock.mock.calls[0][1].method).toBe("PATCH");
    });

    it("api.delete sends DELETE request", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 204,
        json: () => Promise.reject(new Error("no body")),
      });
      vi.stubGlobal("fetch", fetchMock);

      const result = await api.delete("/items/1/");
      expect(result).toBeUndefined();
      expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
    });

    it("appends query params to URL", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      });
      vi.stubGlobal("fetch", fetchMock);

      await api.get("/items/", { page: "2", search: "test" });
      const calledUrl = fetchMock.mock.calls[0][0];
      expect(calledUrl).toContain("page=2");
      expect(calledUrl).toContain("search=test");
    });

    it("includes credentials: include in all requests", async () => {
      const fetchMock = mockFetch({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });
      vi.stubGlobal("fetch", fetchMock);

      await api.get("/test/");
      expect(fetchMock.mock.calls[0][1].credentials).toBe("include");
    });
  });

  describe("error handling", () => {
    it("throws ApiError on non-ok response", async () => {
      const fetchMock = mockFetch({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ detail: "Bad request" }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(api.get("/bad/")).rejects.toThrow(ApiError);
      try {
        await api.get("/bad/");
      } catch (e) {
        expect((e as ApiError).status).toBe(400);
        expect((e as ApiError).data).toEqual({ detail: "Bad request" });
      }
    });

    it("handles non-JSON error responses gracefully", async () => {
      const fetchMock = mockFetch({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error("not json")),
      });
      vi.stubGlobal("fetch", fetchMock);

      try {
        await api.get("/error/");
      } catch (e) {
        expect((e as ApiError).status).toBe(500);
        expect((e as ApiError).data).toBeNull();
      }
    });
  });

  describe("401 retry flow", () => {
    it("retries with new token after successful refresh on 401", async () => {
      setTokens("expired-token", "valid-refresh");

      const fetchMock = mockFetchSequence([
        // First call: 401
        {
          ok: false,
          status: 401,
          json: () => Promise.resolve({ detail: "Token expired" }),
        },
        // Refresh call: success
        {
          ok: true,
          status: 200,
          json: () => Promise.resolve({ access: "new-access", refresh: "new-refresh" }),
        },
        // Retry call: success
        {
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: "success" }),
        },
      ]);
      vi.stubGlobal("fetch", fetchMock);

      const result = await api.get("/protected/");
      expect(result).toEqual({ data: "success" });

      // Verify three fetch calls were made
      expect(fetchMock).toHaveBeenCalledTimes(3);

      // Verify the new access token was stored
      expect(getAccessToken()).toBe("new-access");
    });

    it("calls onAuthFailure when refresh fails", async () => {
      setTokens("expired-token", "expired-refresh");
      const authFailure = vi.fn();
      setOnAuthFailure(authFailure);

      const fetchMock = mockFetchSequence([
        // First call: 401
        {
          ok: false,
          status: 401,
          json: () => Promise.resolve({ detail: "Token expired" }),
        },
        // Refresh call: failure
        {
          ok: false,
          status: 401,
          json: () => Promise.resolve({ detail: "Refresh invalid" }),
        },
      ]);
      vi.stubGlobal("fetch", fetchMock);

      // The original 401 should be returned, causing ApiError
      await expect(api.get("/protected/")).rejects.toThrow(ApiError);
      expect(authFailure).toHaveBeenCalledTimes(1);
      expect(getAccessToken()).toBeNull();
    });

    it("does not retry when no refresh token is available", async () => {
      setTokens("expired-token", null);

      const fetchMock = mockFetch({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ detail: "Unauthorized" }),
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(api.get("/protected/")).rejects.toThrow(ApiError);
      // Only one call - no retry attempt
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("deduplicates concurrent refresh calls", async () => {
      setTokens("expired-token", "valid-refresh");

      let refreshCallCount = 0;

      const makeOkResponse = (data: unknown) => ({
        ok: true,
        status: 200,
        headers: new Headers(),
        redirected: false,
        type: "basic" as ResponseType,
        url: "",
        body: null,
        bodyUsed: false,
        clone: vi.fn(),
        arrayBuffer: vi.fn(),
        formData: vi.fn(),
        text: vi.fn(),
        json: () => Promise.resolve(data),
        blob: () => Promise.resolve(new Blob()),
      });

      const make401Response = () => ({
        ok: false,
        status: 401,
        headers: new Headers(),
        redirected: false,
        type: "basic" as ResponseType,
        url: "",
        body: null,
        bodyUsed: false,
        clone: vi.fn(),
        arrayBuffer: vi.fn(),
        formData: vi.fn(),
        text: vi.fn(),
        json: () => Promise.resolve({ detail: "expired" }),
        blob: () => Promise.resolve(new Blob()),
      });

      const fetchMock = vi.fn().mockImplementation((url: string, config?: RequestInit) => {
        if (url.includes("/auth/token/refresh/")) {
          refreshCallCount++;
          return Promise.resolve(makeOkResponse({ access: "new-access", refresh: "new-refresh" }));
        }

        // Check if this is a retry (has new token via Headers object)
        const headers = config?.headers;
        if (headers instanceof Headers && headers.get("Authorization") === "Bearer new-access") {
          return Promise.resolve(makeOkResponse({ data: "retried" }));
        }

        // Check if this is a retry (has new token via plain object)
        if (headers && typeof headers === "object" && !("get" in headers)) {
          const h = headers as Record<string, string>;
          if (h["Authorization"] === "Bearer new-access") {
            return Promise.resolve(makeOkResponse({ data: "retried" }));
          }
        }

        // First calls: 401
        return Promise.resolve(make401Response());
      });
      vi.stubGlobal("fetch", fetchMock);

      // Fire two concurrent requests that both get 401
      const [result1, result2] = await Promise.all([
        api.get("/resource1/"),
        api.get("/resource2/"),
      ]);

      // Only one refresh call should have been made despite two 401 responses
      expect(refreshCallCount).toBe(1);
      expect(result1).toEqual({ data: "retried" });
      expect(result2).toEqual({ data: "retried" });
    });
  });
});
