import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/auth/guards";
import { assertCsrf, CsrfError } from "@/server/csrf";
import { clientIp } from "@/server/rate-limit";
import { listJobsAdmin, restartJob, manualRefund } from "@/services/admin";
import { InsufficientFundsError } from "@/services/credits";

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const status = new URL(req.url).searchParams.get("status") ?? undefined;
    return NextResponse.json(await listJobsAdmin(status));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.code }, { status: e.status });
    throw e;
  }
}

export async function POST(req: Request) {
  try {
    assertCsrf(req);
    const s = await requireAdmin();
    const ip = clientIp(req);
    const b = (await req.json()) as { action: string; jobId: string };
    if (!b.jobId) return NextResponse.json({ error: "jobId" }, { status: 400 });
    if (b.action === "restart") {
      const j = await restartJob(s.user.id, b.jobId, ip);
      return NextResponse.json({ ok: true, status: j.status });
    }
    if (b.action === "refund") {
      const bal = await manualRefund(s.user.id, b.jobId, ip);
      return NextResponse.json({ ok: true, balance: bal });
    }
    return NextResponse.json({ error: "bad action" }, { status: 400 });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.code }, { status: e.status });
    if (e instanceof CsrfError) return NextResponse.json({ error: "csrf" }, { status: 403 });
    if (e instanceof InsufficientFundsError) return NextResponse.json({ error: e.message, code: "INSUFFICIENT_FUNDS" }, { status: 402 });
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
