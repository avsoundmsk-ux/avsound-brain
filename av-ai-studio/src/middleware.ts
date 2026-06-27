/**
 * Next.js middleware — грубый auth-гейт (БЕЗ обращения к БД).
 * Проверяет лишь наличие cookie сессии (better-auth getSessionCookie).
 * Точная проверка роли (admin/owner) — server-side в guards.ts (requireRole).
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { PROTECTED_PREFIXES, matchPrefix } from "@/auth/routes";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // публичные пути — пропускаем
  if (!matchPrefix(pathname, PROTECTED_PREFIXES)) return NextResponse.next();

  // оптимистичная проверка: есть ли cookie сессии (валидацию делает сервер позже)
  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/owner/:path*"],
};
