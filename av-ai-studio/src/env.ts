/**
 * Валидация критичных env при старте (fail-fast).
 * Импортировать ПЕРВЫМ в auth.ts, чтобы приложение не поднималось со слабым/пустым секретом.
 */
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`[env] ${name} обязателен и не задан`);
  return v;
}

// SECURITY (H-3): секрет подписи сессий — обязателен и достаточной длины.
export const BETTER_AUTH_SECRET: string = (() => {
  const v = required("BETTER_AUTH_SECRET");
  if (v.length < 32) {
    throw new Error("[env] BETTER_AUTH_SECRET должен быть ≥ 32 символов");
  }
  return v;
})();

// SECURITY (H-3): baseURL — валидный URL (нужен для trustedOrigins / CSRF better-auth).
export const BETTER_AUTH_URL: string = (() => {
  const v = required("BETTER_AUTH_URL");
  try {
    new URL(v);
  } catch {
    throw new Error("[env] BETTER_AUTH_URL должен быть валидным URL");
  }
  return v;
})();
