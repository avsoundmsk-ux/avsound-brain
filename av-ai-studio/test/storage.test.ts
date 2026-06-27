import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "../src/db/index.js";
import { topupCredits } from "../src/services/credits.js";
import { createJob, processJob } from "../src/services/jobs.js";
import { persistResult, type Storage } from "../src/storage/storage.js";
import type { Generator } from "../src/generation/generator.js";

const uid = randomUUID();
const noop = async () => {};

// mock storage (всегда настроен)
const mockStorage: Storage = {
  isConfigured: () => true,
  upload: async (key) => `https://r2.local/${key}`,
};
const offStorage: Storage = { isConfigured: () => false, upload: async () => "x" };

const okGen: Generator = async () => ({ outputUrl: "https://provider.tmp/result.mp4", costUsd: 2.29 });

before(async () => {
  await db.insert(schema.user).values({ id: uid, email: `st_${uid}@x.local`, emailVerified: true });
  await topupCredits(uid, 1000, randomUUID(), "test");
});

test("persistResult: provider url → upload mock → stable url", async () => {
  const origFetch = globalThis.fetch;
  // @ts-expect-error мок
  globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer });
  try {
    const r = await persistResult("https://provider.tmp/x.mp4", "job123", noop, mockStorage);
    assert.equal(r.stored, true);
    assert.equal(r.url, "https://r2.local/generations/job123.mp4");
  } finally {
    globalThis.fetch = origFetch;
  }
});

test("persistResult: storage не настроен → fallback provider url", async () => {
  const r = await persistResult("https://provider.tmp/x.mp4", "j2", noop, offStorage);
  assert.equal(r.stored, false);
  assert.equal(r.url, "https://provider.tmp/x.mp4");
});

test("processJob: completed со stable url (storage mock)", async () => {
  const origFetch = globalThis.fetch;
  const job = await createJob(uid, { modelKey: "seedance-2", mode: "text_to_video", prompt: "p", durationSec: 5, resolution: "720p" });
  // @ts-expect-error мок download
  globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => new Uint8Array([9, 9]).buffer });
  try {
    const done = await processJob(job.id, okGen, mockStorage);
    assert.equal(done.status, "completed");
    assert.equal(done.outputUrl, `https://r2.local/generations/${job.id}.mp4`);
  } finally {
    globalThis.fetch = origFetch;
  }
  const [row] = await db.select().from(schema.jobs).where(eq(schema.jobs.id, job.id));
  assert.equal(row.outputUrl, `https://r2.local/generations/${job.id}.mp4`);
  assert.equal((row.params as { stored?: boolean }).stored, true);
  assert.equal((row.params as { providerOutputUrl?: string }).providerOutputUrl, "https://provider.tmp/result.mp4");
});

after(async () => {
  await db.delete(schema.user).where(eq(schema.user.id, uid));
  process.exit(0);
});
