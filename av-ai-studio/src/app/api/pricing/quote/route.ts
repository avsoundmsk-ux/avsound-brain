/**
 * POST /api/pricing/quote — калькулятор цены ДО генерации (backend, авторизованный).
 * body: { modelKey, mode, durationSec?, resolution? }
 * Возвращает себестоимость, цену клиенту, прибыль (в кредитах + USD).
 */
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser, AuthError } from "@/auth/guards";
import { rateLimit, clientIp } from "@/server/rate-limit";
import { estimateCostUsd } from "@/services/providerCost";
import { quote } from "@/services/pricing";

export async function POST(req: Request) {
  const rl = rateLimit(`quote:${clientIp(req)}`, 60, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  try {
    await requireUser();
    const body = (await req.json()) as {
      modelKey?: string; mode?: string; durationSec?: number; resolution?: "480p" | "720p" | "1080p";
    };
    if (!body.modelKey || !body.mode) {
      return NextResponse.json({ error: "modelKey и mode обязательны" }, { status: 400 });
    }

    const [model] = await db.select().from(schema.models).where(eq(schema.models.key, body.modelKey));
    if (!model || !model.enabled) return NextResponse.json({ error: "модель не найдена" }, { status: 404 });

    const [rule] = await db.select().from(schema.priceRules).where(
      and(
        eq(schema.priceRules.modelId, model.id),
        eq(schema.priceRules.mode, body.mode as typeof schema.priceRules.mode.enumValues[number]),
        eq(schema.priceRules.enabled, true),
      ),
    );
    if (!rule) return NextResponse.json({ error: "нет правила цены для режима" }, { status: 404 });

    const costUsd = estimateCostUsd({
      modelKey: model.key,
      mode: body.mode as never,
      durationSec: body.durationSec,
      resolution: body.resolution,
    });
    const q = quote(costUsd, { priceType: rule.priceType, value: rule.value });

    return NextResponse.json({
      model: model.key,
      mode: body.mode,
      priceCredits: q.priceCredits,
      priceUsd: q.priceUsd,
      // себестоимость/прибыль — только для admin/owner показывать на UI; тут отдаём, страница решает
      costCredits: q.costCredits,
      profitCredits: q.profitCredits,
    });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.code }, { status: e.status });
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}
