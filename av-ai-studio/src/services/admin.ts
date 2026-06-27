/**
 * AdminService — операции админки (backend only). Каждое изменение пишет adminAudit.
 * Деньги — через CreditService. Роль проверяется в API (requireAdmin/requireOwner).
 */
import { sql, eq, desc, and } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import * as credits from "./credits.js";
import { enqueueJob } from "../queue/boss.js";

const { user, jobs, jobLogs, creditLedger, models, priceRules, adminAudit, topups } = schema;
type Mode = (typeof schema.modeEnum.enumValues)[number];
type PriceType = (typeof schema.priceTypeEnum.enumValues)[number];

async function audit(adminId: string, action: string, targetType: string, targetId: string, data?: unknown, ip?: string) {
  await db.insert(adminAudit).values({ adminId, action, targetType, targetId, data: data ?? null, ip });
}

// ---------- пользователи ----------
export async function listUsers(limit = 100) {
  // баланс на лету из ledger
  return db.execute(sql`
    select u.id, u.email, u.name, u.role, u.status, u.created_at,
      coalesce((select sum(delta) from credit_ledger l where l.user_id = u.id), 0)::int as balance
    from "user" u order by u.created_at desc limit ${limit}
  `);
}

export async function setUserStatus(adminId: string, userId: string, status: "active" | "blocked", ip?: string) {
  await db.update(user).set({ status }).where(eq(user.id, userId));
  await audit(adminId, status === "blocked" ? "block_user" : "unblock_user", "user", userId, { status }, ip);
}

/** Только owner. Сменить роль. */
export async function setUserRole(adminId: string, userId: string, role: "user" | "admin" | "owner", ip?: string) {
  await db.update(user).set({ role }).where(eq(user.id, userId));
  await audit(adminId, "set_role", "user", userId, { role }, ip);
}

export async function adjustCredits(adminId: string, userId: string, delta: number, note: string, ip?: string) {
  const bal = await credits.adminAdjust(userId, delta, adminId, note);
  await audit(adminId, "adjust_credits", "user", userId, { delta, note, balanceAfter: bal }, ip);
  return bal;
}

// ---------- генерации ----------
export async function listJobsAdmin(status?: string, limit = 100) {
  const base = db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(limit);
  if (status) return db.select().from(jobs).where(eq(jobs.status, status as typeof jobs.status.enumValues[number])).orderBy(desc(jobs.createdAt)).limit(limit);
  return base;
}

export async function jobLogsAdmin(jobId: string) {
  return db.select().from(jobLogs).where(eq(jobLogs.jobId, jobId)).orderBy(desc(jobLogs.createdAt));
}

/** Ручной restart упавшей генерации: повторный hold + enqueue. */
export async function restartJob(adminId: string, jobId: string, ip?: string, enqueue = enqueueJob) {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  if (!job) throw new Error("job не найден");
  if (!["failed", "refunded"].includes(job.status)) throw new Error("restart только для failed/refunded");
  // повторно списываем цену (прошлый hold был возвращён при fail)
  await credits.hold(job.userId, job.priceCredits, job.id, `job ${job.id} restart hold`);
  await db.update(jobs).set({ status: "queued", error: null, finishedAt: null }).where(eq(jobs.id, jobId));
  await db.insert(jobLogs).values({ jobId, level: "info", message: "restart by admin", data: { adminId } });
  await audit(adminId, "restart_job", "job", jobId, null, ip);
  await enqueue(jobId);
  return { ...job, status: "queued" as const };
}

/** Ручной возврат кредитов за job (если ещё не возвращали). */
export async function manualRefund(adminId: string, jobId: string, ip?: string) {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  if (!job) throw new Error("job не найден");
  const bal = await credits.refund(job.userId, job.priceCredits, jobId, `manual refund by admin`);
  await db.update(jobs).set({ status: "refunded" }).where(eq(jobs.id, jobId));
  await audit(adminId, "manual_refund", "job", jobId, { amount: job.priceCredits }, ip);
  return bal;
}

// ---------- цены / модели ----------
export async function listModels() {
  return db.select().from(models);
}

export async function listPriceRules() {
  return db.select().from(priceRules);
}

export async function setPriceRule(adminId: string, opts: {
  modelId: string; mode: Mode; priceType: PriceType; value: number;
}, ip?: string) {
  const [existing] = await db.select().from(priceRules).where(
    and(eq(priceRules.modelId, opts.modelId), eq(priceRules.mode, opts.mode)),
  );
  if (existing) {
    await db.update(priceRules).set({
      priceType: opts.priceType, value: opts.value, enabled: true, updatedBy: adminId, updatedAt: new Date(),
    }).where(eq(priceRules.id, existing.id));
  } else {
    await db.insert(priceRules).values({
      modelId: opts.modelId, mode: opts.mode, priceType: opts.priceType, value: opts.value, updatedBy: adminId,
    });
  }
  await audit(adminId, "set_price", "price_rule", `${opts.modelId}:${opts.mode}`, opts, ip);
}

// ---------- статистика / прибыль ----------
export async function stats() {
  const [u] = await db.execute(sql`select count(*)::int as n from "user"`) as unknown as { n: number }[];
  const [j] = await db.execute(sql`
    select
      count(*)::int as total,
      count(*) filter (where status='completed')::int as completed,
      count(*) filter (where status='failed')::int as failed,
      count(*) filter (where status in ('queued','processing'))::int as active,
      coalesce(sum(price_credits) filter (where status='completed'),0)::int as revenue_credits,
      coalesce(sum(profit_credits) filter (where status='completed'),0)::int as profit_credits,
      coalesce(sum(cost_credits) filter (where status='completed'),0)::int as cost_credits
    from jobs
  `) as unknown as Record<string, number>[];
  const [t] = await db.execute(sql`select coalesce(sum(credits),0)::int as topup_credits from topups where status='paid'`) as unknown as { topup_credits: number }[];
  return { users: u.n, jobs: j, topups: t };
}

export async function auditLog(limit = 100) {
  return db.select().from(adminAudit).orderBy(desc(adminAudit.createdAt)).limit(limit);
}
