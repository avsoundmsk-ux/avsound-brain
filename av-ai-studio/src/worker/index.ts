/**
 * Воркер генераций. Запуск отдельным процессом: `npm run worker`.
 * Берёт job из очереди → processJob(modelArkGenerator) → settle/refund.
 */
import "dotenv/config";
import { getBoss, QUEUE } from "../queue/boss.js";
import { processJob } from "../services/jobs.js";
import { modelArkGenerator } from "../generation/generator.js";

async function main() {
  const boss = await getBoss();
  await boss.work(QUEUE, async (jobs) => {
    for (const j of jobs) {
      const jobId = (j.data as { jobId: string }).jobId;
      console.log("[worker] processing", jobId);
      await processJob(jobId, modelArkGenerator);
    }
  });
  console.log("[worker] running, queue:", QUEUE);
}
main().catch((e) => { console.error("[worker] fatal", e); process.exit(1); });
