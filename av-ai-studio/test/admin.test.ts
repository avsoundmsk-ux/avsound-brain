import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "../src/db/index.js";
import { topupCredits, getBalance } from "../src/services/credits.js";
import { createJob, processJob } from "../src/services/jobs.js";
import * as admin from "../src/services/admin.js";
import type { Generator } from "../src/generation/generator.js";

const ownerId = randomUUID();
const uid = randomUUID();
const failGen: Generator = async () => { throw new Error("boom"); };
let jobId = "";
let modelId = "";

before(async () => {
  await db.insert(schema.user).values([
    { id: ownerId, email: `owner_${ownerId}@x.local`, emailVerified: true, role: "owner" },
    { id: uid, email: `usr_${uid}@x.local`, emailVerified: true },
  ]);
  await topupCredits(uid, 5000, randomUUID(), "test");
  const job = await createJob(uid, { modelKey: "seedance-2", mode: "text_to_video", prompt: "p", durationSec: 5, resolution: "720p" });
  jobId = job.id;
  await processJob(jobId, failGen); // → failed + refund
  const [m] = await db.select().from(schema.models).where(eq(schema.models.key, "seedance-2"));
  modelId = m.id;
});

test("stats считает", async () => {
  const s = await admin.stats();
  assert.ok(s.users >= 2);
  assert.ok(typeof s.jobs.total === "number");
});

test("block / unblock user", async () => {
  await admin.setUserStatus(ownerId, uid, "blocked");
  let [u] = await db.select().from(schema.user).where(eq(schema.user.id, uid));
  assert.equal(u.status, "blocked");
  await admin.setUserStatus(ownerId, uid, "active");
  [u] = await db.select().from(schema.user).where(eq(schema.user.id, uid));
  assert.equal(u.status, "active");
});

test("adjust credits", async () => {
  const before = await getBalance(uid);
  const bal = await admin.adjustCredits(ownerId, uid, 100, "bonus");
  assert.equal(bal, before + 100);
});

test("set price rule", async () => {
  await admin.setPriceRule(ownerId, { modelId, mode: "text_to_video", priceType: "multiplier", value: 300 });
  const [r] = await db.select().from(schema.priceRules)
    .where(eq(schema.priceRules.modelId, modelId));
  assert.ok(r.value === 300 || (await admin.listPriceRules()).some((x) => x.value === 300));
});

test("restart failed job (re-hold + queued)", async () => {
  const before = await getBalance(uid);
  const j = await admin.restartJob(ownerId, jobId, undefined, async () => {}); // enqueue noop
  assert.equal(j.status, "queued");
  const [row] = await db.select().from(schema.jobs).where(eq(schema.jobs.id, jobId));
  assert.equal(row.status, "queued");
  assert.ok((await getBalance(uid)) < before, "restart должен заново списать (hold)");
});

test("audit пишется", async () => {
  const log = await admin.auditLog(50);
  assert.ok(log.some((a) => a.action === "set_price"));
  assert.ok(log.some((a) => a.action === "restart_job"));
});

after(async () => {
  // вернуть seed-цену (×2), чтобы не ломать остальные тесты
  await db.update(schema.priceRules)
    .set({ priceType: "multiplier", value: 200 })
    .where(eq(schema.priceRules.modelId, modelId));
  // admin_audit ссылается на owner (без cascade) — чистим перед удалением owner
  await db.delete(schema.adminAudit).where(eq(schema.adminAudit.adminId, ownerId));
  await db.delete(schema.user).where(eq(schema.user.id, uid));
  await db.delete(schema.user).where(eq(schema.user.id, ownerId));
  process.exit(0);
});
