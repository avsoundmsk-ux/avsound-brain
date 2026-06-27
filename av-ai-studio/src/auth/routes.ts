/**
 * Группы маршрутов для защиты. Делятся между middleware (грубый гейт) и
 * guards (точная проверка роли server-side).
 *
 * Публичное = всё, что не попало в защищённые префиксы (вкл. /, /sign-in, /api/auth/*).
 */
export const AUTH_ONLY_PREFIXES = ["/dashboard"];
export const ADMIN_ONLY_PREFIXES = ["/admin"];
export const OWNER_ONLY_PREFIXES = ["/owner"];

export const PROTECTED_PREFIXES = [
  ...AUTH_ONLY_PREFIXES,
  ...ADMIN_ONLY_PREFIXES,
  ...OWNER_ONLY_PREFIXES,
];

export function matchPrefix(path: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) => path === p || path.startsWith(p + "/"));
}
