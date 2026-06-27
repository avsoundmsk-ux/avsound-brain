import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/auth/guards";
import { assertCsrf, CsrfError } from "@/server/csrf";
import { clientIp } from "@/server/rate-limit";
import { listModels, listPriceRules, setPriceRule } from "@/services/admin";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json({ models: await listModels(), rules: await listPriceRules() });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.code }, { status: e.status });
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    assertCsrf(req);
    const s = await requireAdmin();
    const b = (await req.json()) as { modelId: string; mode: string; priceType: string; value: number };
    if (!b.modelId || !b.mode || !b.priceType || typeof b.value !== "number") {
      return NextResponse.json({ error: "modelId, mode, priceType, value обязательны" }, { status: 400 });
    }
    await setPriceRule(s.user.id, { modelId: b.modelId, mode: b.mode as never, priceType: b.priceType as never, value: b.value }, clientIp(req));
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.code }, { status: e.status });
    if (e instanceof CsrfError) return NextResponse.json({ error: "csrf" }, { status: 403 });
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
