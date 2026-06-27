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

/**
 * SECURITY (H-4): роль валидируется в рантайме, не через unsafe as-cast.
 * Любое неизвестное значение → "user" (безопасный минимум), а не undefined,
 * чтобы `ROLE_RANK[role]` никогда не был undefined.
 */
function normalizeRole(v: unknown): Role {
  return v === "owner" || v === "admin" ? v : "user";
}

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
  const u = s.user as Record<string, unknown>;
  if (u.status === "blocked") throw new AuthError("BLOCKED", 403);
  return s;
}

/** Требует роль не ниже min (user < admin < owner). */
export async function requireRole(min: Role) {
  const s = await requireUser();
  const role = normalizeRole((s.user as Record<string, unknown>).role);
  if (ROLE_RANK[role] < ROLE_RANK[min]) throw new AuthError("FORBIDDEN", 403);
  return s;
}

export const requireAdmin = () => requireRole("admin");
export const requireOwner = () => requireRole("owner");
