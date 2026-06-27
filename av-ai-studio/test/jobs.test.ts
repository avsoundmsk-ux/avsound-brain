import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "../src/db/index.js";
import { topupCredits, getBalance } from "../src/services/credits.js";
import { createJob, processJob } from "../src/services/jobs.js";
import type { Generator } from "../src/generation/generator.js";

const uid = randomUUID();
const PRICE = 458; // 15с 720p t2v ×2 (cost $2.29 → 229 cr → ×2)

before(async () => {
  await db.insert(schema.user).values({ id: uid, email: `jobtest_${uid}@x.local`, emailVerified: true });
  await topupCredits(uid, 1000, randomUUID(), "test");
});

const successGen: Generator = async () => ({ outputUrl: "https://example.com/result.mp4", costUsd: 2.29, providerTaskId: "t1" });
const failGen: Generator = async () => { throw new Error("provider boom"); };

test("успех: create → hold → complete → settle", async () => {
  assert.equal(await getBalance(uid), 1000);

  const job = await createJob(uid, {
    modelKey: "seedance-2", mode: "text_to_video", prompt: "car audio promo",
    durationSec: 15, resolution: "720p",
  }); // enqueue = noop по умолчанию
  assert.equal(job.status, "queued");
  assert.equal(job.priceCredits, PRICE);
  assert.equal(await getBalance(uid), 1000 - PRICE); // hold списал

  const done = await processJob(job.id, successGen);
  assert.equal(done.status, "completed");
  assert.equal(done.outputUrl, "https://example.com/result.mp4");
  assert.equal(await getBalance(uid), 1000 - PRICE); // settle не меняет баланс

  const [row] = await db.select().from(schema.jobs).where(eq(schema.jobs.id, job.id));
  assert.equal(row.status, "completed");
  assert.equal(row.costCredits, 229);
  assert.equal(row.profitCredits, PRICE - 229);
});

test("ошибка: create → hold → fail → refund", async () => {
  const balBefore = await getBalance(uid);
  const job = await createJob(uid, {
    modelKey: "seedance-2", mode: "text_to_video", prompt: "fail case",
    durationSec: 15, resolution: "720p",
  });
  assert.equal(await getBalance(uid), balBefore - PRICE); // hold

  const failed = await processJob(job.id, failGen);
  assert.equal(failed.status, "failed");
  assert.equal(await getBalance(uid), balBefore); // refund вернул

  const [row] = await db.select().from(schema.jobs).where(eq(schema.jobs.id, job.id));
  assert.equal(row.status, "failed");
  assert.match(row.error ?? "", /boom/);
});

test("job_logs пишутся", async () => {
  const [j] = await db.select().from(schema.jobs).where(eq(schema.jobs.userId, uid)).limit(1);
  const logs = await db.select().from(schema.jobLogs).where(eq(schema.jobLogs.jobId, j.id));
  assert.ok(logs.length > 0, "должны быть логи job");
});

after(async () => {
  await db.delete(schema.user).where(eq(schema.user.id, uid)); // cascade: jobs, job_logs, ledger
  process.exit(0);
});
