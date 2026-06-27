/**
 * JobService — жизненный цикл генерации (backend only).
 * createJob:  цена ДО запуска → hold кредитов → запись job → enqueue.
 * processJob: generator → success: settle + completed + result_url
 *                         fail:    refund  + failed
 * Все деньги — через CreditService (immutable ledger). Логи — job_logs.
 */
import { eq, and, desc } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { estimateCostUsd } from "./providerCost.js";
import { quote, costToCredits } from "./pricing.js";
import * as credits from "./credits.js";
import { persistResult, defaultStorage, type Storage } from "../storage/storage.js";
import type { Generator, GenInput } from "../generation/generator.js";

const { jobs, jobLogs, models, priceRules } = schema;
type Mode = (typeof schema.modeEnum.enumValues)[number];

export interface CreateJobInput {
  modelKey: string;
  mode: Mode;
  prompt: string;
  durationSec?: number;
  resolution?: "480p" | "720p" | "1080p";
  aspectRatio?: string;
  inputImages?: string[];
}

async function jlog(jobId: string, message: string, data?: unknown, level = "info") {
  await db.insert(jobLogs).values({ jobId, level, message, data: data ?? null });
}

/** Создать job: считает цену, холдит кредиты, ставит в очередь. */
export async function createJob(
  userId: string,
  inp: CreateJobInput,
  enqueue: (jobId: string) => Promise<void> = async () => {},
) {
  if (!inp.prompt?.trim()) throw new Error("prompt обязателен");

  const [model] = await db.select().from(models).where(eq(models.key, inp.modelKey));
  if (!model || !model.enabled) throw new Error("модель не найдена/выключена");

  const [rule] = await db.select().from(priceRules).where(
    and(eq(priceRules.modelId, model.id), eq(priceRules.mode, inp.mode), eq(priceRules.enabled, true)),
  );
  if (!rule) throw new Error("нет правила цены для режима");

  const costUsd = estimateCostUsd({ modelKey: model.key, mode: inp.mode as never, durationSec: inp.durationSec, resolution: inp.resolution });
  const q = quote(costUsd, { priceType: rule.priceType, value: rule.value });

  // запись job (created) → затем hold (списываем цену)
  const [job] = await db.insert(jobs).values({
    userId, modelId: model.id, mode: inp.mode, status: "created",
    prompt: inp.prompt, params: {
      durationSec: inp.durationSec, resolution: inp.resolution,
      aspectRatio: inp.aspectRatio, inputImages: inp.inputImages,
      providerModelId: model.providerModelId,
    },
    priceCredits: q.priceCredits,
  }).returning();

  try {
    await credits.hold(userId, q.priceCredits, job.id, `job ${job.id} hold`);
  } catch (e) {
    await db.update(jobs).set({ status: "failed", error: (e as Error).message, finishedAt: new Date() }).where(eq(jobs.id, job.id));
    await jlog(job.id, "hold failed", { error: (e as Error).message }, "error");
    throw e;
  }

  await db.update(jobs).set({ status: "queued" }).where(eq(jobs.id, job.id));
  await jlog(job.id, "queued", { priceCredits: q.priceCredits, costUsd });
  await enqueue(job.id);
  return { ...job, status: "queued" as const };
}

/** Обработать job: generator → storage → settle/refund. Идемпотентно по статусу. */
export async function processJob(jobId: string, generator: Generator, storage: Storage = defaultStorage) {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  if (!job) throw new Error("job не найден");
  if (!["queued", "created"].includes(job.status)) {
    return job; // уже обработан/в работе — не дублируем
  }

  await db.update(jobs).set({ status: "processing", startedAt: new Date(), attempts: job.attempts + 1 }).where(eq(jobs.id, jobId));
  await jlog(jobId, "processing start");

  const p = (job.params ?? {}) as Record<string, unknown>;
  const genInput: GenInput = {
    providerModelId: String(p.providerModelId ?? ""),
    mode: job.mode,
    modelKey: "", // не нужен генератору кроме оценки cost; заполним из params если надо
    prompt: job.prompt,
    durationSec: p.durationSec as number | undefined,
    resolution: p.resolution as GenInput["resolution"],
    aspectRatio: p.aspectRatio as string | undefined,
    inputImages: p.inputImages as string[] | undefined,
  };

  try {
    const result = await generator(genInput, (m, d) => jlog(jobId, m, d));
    // переложить результат в своё хранилище (stable url); fallback — provider url
    const persisted = await persistResult(
      result.outputUrl, jobId, (m, d, lvl) => jlog(jobId, m, d, lvl ?? "info"), storage,
    );
    const costCredits = costToCredits(result.costUsd);
    const profitCredits = job.priceCredits - costCredits;
    await db.update(jobs).set({
      status: "completed", outputUrl: persisted.url, providerTaskId: result.providerTaskId,
      costCredits, profitCredits, finishedAt: new Date(),
      params: { ...(job.params as object ?? {}), providerOutputUrl: result.outputUrl, stored: persisted.stored },
    }).where(eq(jobs.id, jobId));
    await credits.settle(job.userId, jobId, `job ${jobId} settle`);
    await jlog(jobId, "completed", { outputUrl: persisted.url, stored: persisted.stored, costCredits, profitCredits });
    return { ...job, status: "completed" as const, outputUrl: persisted.url };
  } catch (e) {
    const msg = (e as Error).message;
    await db.update(jobs).set({ status: "failed", error: msg, finishedAt: new Date() }).where(eq(jobs.id, jobId));
    await credits.refund(job.userId, job.priceCredits, jobId, `job ${jobId} refund`);
    await jlog(jobId, "failed → refunded", { error: msg }, "error");
    return { ...job, status: "failed" as const, error: msg };
  }
}

export async function listJobs(userId: string, limit = 50) {
  return db.select().from(jobs).where(eq(jobs.userId, userId)).orderBy(desc(jobs.createdAt)).limit(limit);
}

export async function getJob(userId: string, jobId: string) {
  const [job] = await db.select().from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.userId, userId)));
  return job ?? null;
}
