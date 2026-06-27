/**
 * POST /api/jobs — создать генерацию (hold кредитов + enqueue).
 * GET  /api/jobs — история генераций пользователя.
 */
import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/auth/guards";
import { assertCsrf, CsrfError } from "@/server/csrf";
import { rateLimit, clientIp } from "@/server/rate-limit";
import { createJob, listJobs } from "@/services/jobs";
import { enqueueJob } from "@/queue/boss";
import { InsufficientFundsError } from "@/services/credits";

export async function POST(req: Request) {
  const rl = rateLimit(`jobs:${clientIp(req)}`, 20, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });
  try {
    assertCsrf(req);
    const s = await requireUser();
    const body = (await req.json()) as {
      modelKey?: string; mode?: string; prompt?: string;
      durationSec?: number; resolution?: "480p" | "720p" | "1080p"; aspectRatio?: string; inputImages?: string[];
    };
    if (!body.modelKey || !body.mode || !body.prompt) {
      return NextResponse.json({ error: "modelKey, mode, prompt обязательны" }, { status: 400 });
    }
    const job = await createJob(s.user.id, {
      modelKey: body.modelKey, mode: body.mode as never, prompt: body.prompt,
      durationSec: body.durationSec, resolution: body.resolution,
      aspectRatio: body.aspectRatio, inputImages: body.inputImages,
    }, enqueueJob);
    return NextResponse.json({ id: job.id, status: job.status, priceCredits: job.priceCredits });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.code }, { status: e.status });
    if (e instanceof CsrfError) return NextResponse.json({ error: "csrf" }, { status: 403 });
    if (e instanceof InsufficientFundsError) return NextResponse.json({ error: e.message, code: "INSUFFICIENT_FUNDS" }, { status: 402 });
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function GET(req: Request) {
  const rl = rateLimit(`jobs-list:${clientIp(req)}`, 60, 60_000);
  if (!rl.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  try {
    const s = await requireUser();
    return NextResponse.json(await listJobs(s.user.id));
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.code }, { status: e.status });
    throw e;
  }
}
