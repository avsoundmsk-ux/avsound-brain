/**
 * Server-side guards — точная проверка аутентификации и роли.
 * Используют auth.api.getSession (обращается к БД) → вызывать ТОЛЬКО на сервере
 * (route handlers, server components, server actions). Не в middleware.
 *
 * Пока нет DATABASE_URL — не вызываются вживую, но типобезопасны.
 */
import { headers } from "next/headers";
import { auth } from "@/auth/auth";

export type Role = "user" | "admin" | "owner";

const ROLE_RANK: Record<Role, number> = { user: 0, admin: 1, owner: 2 };

export class AuthError extends Error {
  constructor(
    public readonly code: "UNAUTHENTICATED" | "FORBIDDEN" | "BLOCKED",
    public readonly status: number,
  ) {
    super(code);
    this.name = "AuthError";
  }
}

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** Требует залогиненного, активного пользователя. */
export async function requireUser() {
  const s = await getSession();
  if (!s) throw new AuthError("UNAUTHENTICATED", 401);
  const status = (s.user as { status?: string }).status ?? "active";
  if (status === "blocked") throw new AuthError("BLOCKED", 403);
  return s;
}

/** Требует роль не ниже min (user < admin < owner). */
export async function requireRole(min: Role) {
  const s = await requireUser();
  const role = ((s.user as { role?: Role }).role ?? "user");
  if (ROLE_RANK[role] < ROLE_RANK[min]) throw new AuthError("FORBIDDEN", 403);
  return s;
}

export const requireAdmin = () => requireRole("admin");
export const requireOwner = () => requireRole("owner");
