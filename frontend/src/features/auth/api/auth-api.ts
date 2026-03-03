import { api } from "@/lib/api-client";
import type { User } from "@/types";

interface LoginPayload {
  email: string;
  password: string;
}

export async function loginUser(email: string, password: string): Promise<void> {
  await api.post<void>("/auth/login/", { email, password } satisfies LoginPayload);
}

export async function logoutUser(): Promise<void> {
  await api.post<void>("/auth/logout/");
}

export async function getCurrentUser(): Promise<User> {
  return api.get<User>("/auth/me/");
}
