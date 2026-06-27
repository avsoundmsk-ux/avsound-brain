/**
 * In-memory rate limiter (на инстанс). MVP — без Redis/БД.
 *
 * ⚠️ KNOWN RISK (C-2/M-2): счётчик живёт в памяти ОДНОГО инстанса.
 * На serverless (Vercel) / мульти-воркере лимит фиктивен — fan-out по lambda.
 * ПРИГОДНО ТОЛЬКО ДЛЯ DEV / single-instance.
 * ДО PRODUCTION заменить на durable store (Upstash Redis / Postgres-таблица).
 * Это БЛОКЕР production (см. SECURITY.md). То же касается better-auth rateLimit (storage: memory).
 */
type Bucket = { count: number; resetAt: number };
const store = new Map<string, Bucket>();

export type RateResult = { ok: boolean; remaining: number; retryAfter: number };

export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  const b = store.get(key);
  if (!b || now > b.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }
  b.count++;
  if (b.count > limit) {
    return { ok: false, remaining: 0, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  return { ok: true, remaining: limit - b.count, retryAfter: 0 };
}

/**
 * IP клиента ТОЛЬКО из доверенных источников.
 * SECURITY (C-1): произвольный `x-forwarded-for` спуфится клиентом → не используем.
 * Доверенные заголовки, выставляемые инфраструктурой (клиент не может переопределить):
 *  - Vercel: `x-vercel-forwarded-for`
 *  - reverse-proxy (Nginx/HAProxy на Hetzner): `x-real-ip`
 * Нет доверенного источника → "unknown" (fail-safe: общий, более строгий лимит).
 */
export function clientIp(req: Request): string {
  const vercel = req.headers.get("x-vercel-forwarded-for");
  if (vercel) return vercel.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
