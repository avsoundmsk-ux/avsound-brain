/**
 * GET  /api/topups — пакеты + история пополнений пользователя.
 * POST /api/topups — создать намерение пополнения (pending). Баланс НЕ меняется.
 */
import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/auth/guards";
import { assertCsrf, CsrfError } from "@/server/csrf";
import { rateLimit, clientIp } from "@/server/rate-limit";
import { createIntent, listTopups } from "@/services/topups";
import { PACKAGES } from "@/services/packages";

export async function GET() {
  try {
    const s = await requireUser();
    return NextResponse.json({ packages: PACKAGES, topups: await listTopups(s.user.id) });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.code }, { status: e.status });
    throw e;
  }
}

export async function POST(req: Request) {
  const rl = rateLimit(`topup:${clientIp(req)}`, 20, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  try {
    assertCsrf(req);
    const s = await requireUser();
    const b = (await req.json()) as { packageId?: string };
    if (!b.packageId) return NextResponse.json({ error: "packageId обязателен" }, { status: 400 });
    const t = await createIntent(s.user.id, b.packageId);
    return NextResponse.json({ id: t.id, status: t.status, credits: t.credits, amountMinor: t.amountMinor });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.code }, { status: e.status });
    if (e instanceof CsrfError) return NextResponse.json({ error: "csrf" }, { status: 403 });
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
