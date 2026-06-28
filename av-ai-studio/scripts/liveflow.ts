/**
 * Live-flow E2E прогон (реальная генерация ModelArk, free quota).
 * Запуск: npx tsx scripts/liveflow.ts
 * Шаги: user → dev-topup → job → process(worker-логика) → settle/refund → история.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "../src/db/index.js";
import { getBalance } from "../src/services/credits.js";
import { createIntent, confirmDev, listTopups } from "../src/services/topups.js";
import { createJob, processJob, listJobs } from "../src/services/jobs.js";
import { modelArkGenerator } from "../src/generation/generator.js";
import type { Generator } from "../src/generation/generator.js";

const uid = randomUUID();
const failGen: Generator = async () => { throw new Error("simulated provider failure"); };
const log = (s: string) => console.log(`\n▶ ${s}`);

async function main() {
  log("1) Регистрация (создаём пользователя — как после sign-up)");
  await db.insert(schema.user).values({ id: uid, email: `liveflow_${uid}@x.local`, emailVerified: true });
  console.log("  user:", uid);

  log("2) Dev-пополнение");
  const t = await createIntent(uid, "p1000");
  console.log("  intent:", t.id, t.status, `${t.credits}кр`);
  const c = await confirmDev(t.id, uid);
  console.log("  confirmed, credited:", c.credited, "balance:", await getBalance(uid));

  log("3) Создание генерации из UI-пути (createJob)");
  const job = await createJob(uid, { modelKey: "seedance-2", mode: "text_to_video", prompt: "red sports car at night, neon city, cinematic", durationSec: 4, resolution: "720p" });
  console.log("  job:", job.id, "status:", job.status, "price:", job.priceCredits);
  console.log("  balance после hold:", await getBalance(uid));

  log("4-6) Worker → реальная генерация ModelArk → settle");
  const done = await processJob(job.id, modelArkGenerator); // та же логика, что в воркере
  console.log("  status:", done.status);
  console.log("  9) ССЫЛКА РЕЗУЛЬТАТА:", done.outputUrl);
  console.log("  balance после settle:", await getBalance(uid), "(не должен измениться — hold стал оплатой)");

  log("5b) Ошибочная генерация → refund");
  const balBefore = await getBalance(uid);
  const job2 = await createJob(uid, { modelKey: "seedance-2", mode: "text_to_video", prompt: "fail case", durationSec: 4, resolution: "720p" });
  console.log("  balance после hold:", await getBalance(uid));
  const failed = await processJob(job2.id, failGen);
  console.log("  status:", failed.status, "| balance после refund:", await getBalance(uid), "(вернулся к", balBefore, ")");

  log("7) История генераций");
  for (const j of await listJobs(uid)) console.log(`  - ${j.status.padEnd(10)} ${j.priceCredits}кр  ${(j.outputUrl ?? "—").slice(0, 60)}`);

  log("8) История пополнений");
  for (const x of await listTopups(uid)) console.log(`  - ${x.status} ${x.credits}кр ${(x.amountMinor / 100)}₽`);

  log("ИТОГ");
  console.log("  баланс:", await getBalance(uid), "| генераций:", (await listJobs(uid)).length);

  // cleanup
  await db.delete(schema.user).where(eq(schema.user.id, uid));
  console.log("\n✓ live-flow завершён, тест-данные удалены");
  process.exit(0);
}
main().catch((e) => { console.error("✖ live-flow error:", e); process.exit(1); });
