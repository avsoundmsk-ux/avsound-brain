/**
 * POST /api/topups/confirm — DEV-подтверждение оплаты (только не-production).
 * Боевой путь — webhook ЮKassa/Stripe (заменит этот эндпоинт, та же confirmPaid).
 * Баланс меняется ТОЛЬКО здесь, на backend, после перевода topup pending→paid.
 */
import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/auth/guards";
import { assertCsrf, CsrfError } from "@/server/csrf";
import { confirmDev } from "@/services/topups";

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "dev-confirm отключён в production (используйте оплату)" }, { status: 403 });
  }
  try {
    assertCsrf(req);
    const s = await requireUser();
    const b = (await req.json()) as { topupId?: string };
    if (!b.topupId) return NextResponse.json({ error: "topupId обязателен" }, { status: 400 });
    const r = await confirmDev(b.topupId, s.user.id);
    return NextResponse.json({ ok: true, credited: r.credited, balance: r.balance ?? null });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.code }, { status: e.status });
    if (e instanceof CsrfError) return NextResponse.json({ error: "csrf" }, { status: 403 });
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
