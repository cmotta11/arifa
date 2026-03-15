import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  api,
  ApiError,
  setTokens,
  clearTokens,
  setOnAuthFailure,
} from "@/lib/api-client";
import type { User } from "@/types";

interface TokenResponse {
  access: string;
  refresh: string;
}

interface MagicLinkTokenResponse {
  user: User;
  access: string;
  refresh: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithMagicToken: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const data = await api.get<User>("/auth/me/");
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Register global auth failure callback
  useEffect(() => {
    setOnAuthFailure(() => {
      clearTokens();
      setUser(null);
    });
    return () => setOnAuthFailure(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    // Try JWT login first
    try {
      const tokens = await api.post<TokenResponse>("/auth/token/", {
        email,
        password,
      });
      setTokens(tokens.access, tokens.refresh);
    } catch (err) {
      // Bad credentials — re-throw immediately, don't fall back to session
      if (err instanceof ApiError && (err.status === 400 || err.status === 401)) {
        throw err;
      }
      // Network error or 404 (JWT endpoint not deployed) — fall back to session login
      await api.post("/auth/login/", { email, password });
    }
    await fetchUser();
  }, [fetchUser]);

  const loginWithMagicToken = useCallback(async (token: string) => {
    const response = await api.post<MagicLinkTokenResponse>(
      "/auth/magic-link/validate/",
      { token },
    );
    if (response.access && response.refresh) {
      setTokens(response.access, response.refresh);
    }
    setUser(response.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout/");
    } catch {
      // Ignore logout errors
    }
    clearTokens();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        loginWithMagicToken,
        logout,
        refetchUser: fetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
