/**
 * Пример auth-only роута — эталон применения foundation:
 * rate-limit → requireUser (роль/статус) → ответ.
 * (Mutation-роуты дополнительно вызывают assertCsrf из server/csrf.)
 */
import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/auth/guards";
import { rateLimit, clientIp } from "@/server/rate-limit";

export async function GET(req: Request) {
  const rl = rateLimit(`me:${clientIp(req)}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  try {
    const s = await requireUser();
    return NextResponse.json({
      id: s.user.id,
      email: s.user.email,
      role: (s.user as { role?: string }).role ?? "user",
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.code }, { status: e.status });
    }
    throw e;
  }
}
