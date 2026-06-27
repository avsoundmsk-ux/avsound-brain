/**
 * GET /api/credits/history — баланс + последние движения кредитов текущего юзера.
 */
import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser, AuthError } from "@/auth/guards";
import { getBalance } from "@/services/credits";
import { rateLimit, clientIp } from "@/server/rate-limit";

export async function GET(req: Request) {
  const rl = rateLimit(`credits:${clientIp(req)}`, 30, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  try {
    const s = await requireUser();
    const balance = await getBalance(s.user.id);
    const entries = await db
      .select({
        type: schema.creditLedger.type,
        delta: schema.creditLedger.delta,
        balanceAfter: schema.creditLedger.balanceAfter,
        note: schema.creditLedger.note,
        createdAt: schema.creditLedger.createdAt,
      })
      .from(schema.creditLedger)
      .where(eq(schema.creditLedger.userId, s.user.id))
      .orderBy(desc(schema.creditLedger.createdAt))
      .limit(50);
    return NextResponse.json({ balance, entries });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.code }, { status: e.status });
    throw e;
  }
}
