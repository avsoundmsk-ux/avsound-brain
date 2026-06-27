/**
 * pg-boss очередь генераций (использует тот же Postgres, схема "pgboss").
 * Ленивый старт. enqueueJob — из API; work — в воркере.
 */
import PgBoss from "pg-boss";

export const QUEUE = "generate";
let boss: PgBoss | null = null;

export async function getBoss(): Promise<PgBoss> {
  if (!boss) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL не задан");
    boss = new PgBoss({ connectionString: process.env.DATABASE_URL });
    await boss.start();
    await boss.createQueue(QUEUE);
  }
  return boss;
}

export async function enqueueJob(jobId: string): Promise<void> {
  const b = await getBoss();
  await b.send(QUEUE, { jobId }, { retryLimit: 2, retryDelay: 30, expireInMinutes: 15 });
}
