/**
 * CreditService — баланс и движения кредитов. ТОЛЬКО backend.
 * Баланс = SUM(delta) по credit_ledger (immutable, не редактируем записи).
 * Конкурентность: pg_advisory_xact_lock(hashtext(userId)) внутри транзакции —
 * два запроса одного юзера не спишут баланс в минус.
 *
 * Модель движений:
 *  topup  (+)  пополнение
 *  hold   (−)  списание при запуске генерации
 *  refund (+)  возврат при ошибке генерации
 *  settle ( 0) маркер завершения (баланс не меняет; для истории)
 *  adjust (±)  ручная правка админом
 *  bonus  (+)  промокод/реферал
 */
import { sql, eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";

const { creditLedger } = schema;

export async function getBalance(userId: string): Promise<number> {
  const [row] = await db
    .select({ bal: sql<number>`coalesce(sum(${creditLedger.delta}), 0)::int` })
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId));
  return row?.bal ?? 0;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function balanceInTx(tx: Tx, userId: string): Promise<number> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
  const [row] = await tx
    .select({ bal: sql<number>`coalesce(sum(${creditLedger.delta}), 0)::int` })
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId));
  return row?.bal ?? 0;
}

export class InsufficientFundsError extends Error {
  constructor(public need: number, public have: number) {
    super(`Недостаточно кредитов: нужно ${need}, есть ${have}`);
    this.name = "InsufficientFundsError";
  }
}

/** Списать price при запуске. Бросает InsufficientFundsError если не хватает. */
export async function hold(userId: string, amount: number, jobId: string, note?: string) {
  if (amount <= 0) throw new Error("hold amount must be > 0");
  return db.transaction(async (tx) => {
    const bal = await balanceInTx(tx, userId);
    if (bal < amount) throw new InsufficientFundsError(amount, bal);
    const balanceAfter = bal - amount;
    await tx.insert(creditLedger).values({ userId, type: "hold", delta: -amount, balanceAfter, jobId, note });
    return balanceAfter;
  });
}

/** Вернуть price при ошибке генерации (идемпотентно по jobId). */
export async function refund(userId: string, amount: number, jobId: string, note?: string) {
  return db.transaction(async (tx) => {
    // защита от двойного возврата
    const existing = await tx
      .select({ id: creditLedger.id })
      .from(creditLedger)
      .where(sql`${creditLedger.jobId} = ${jobId} and ${creditLedger.type} = 'refund'`);
    if (existing.length) return balanceInTx(tx, userId);
    const bal = await balanceInTx(tx, userId);
    const balanceAfter = bal + amount;
    await tx.insert(creditLedger).values({ userId, type: "refund", delta: amount, balanceAfter, jobId, note });
    return balanceAfter;
  });
}

/** Маркер завершения (баланс не меняет). */
export async function settle(userId: string, jobId: string, note?: string) {
  return db.transaction(async (tx) => {
    const bal = await balanceInTx(tx, userId);
    await tx.insert(creditLedger).values({ userId, type: "settle", delta: 0, balanceAfter: bal, jobId, note });
    return bal;
  });
}

/** Пополнение (после подтверждённой оплаты). */
export async function topupCredits(userId: string, credits: number, topupId: string, note?: string) {
  if (credits <= 0) throw new Error("credits must be > 0");
  return db.transaction(async (tx) => {
    const bal = await balanceInTx(tx, userId);
    const balanceAfter = bal + credits;
    await tx.insert(creditLedger).values({ userId, type: "topup", delta: credits, balanceAfter, topupId, note });
    return balanceAfter;
  });
}

/** Ручная правка админом (± кредиты). */
export async function adminAdjust(userId: string, delta: number, adminId: string, note: string) {
  return db.transaction(async (tx) => {
    const bal = await balanceInTx(tx, userId);
    const balanceAfter = bal + delta;
    if (balanceAfter < 0) throw new InsufficientFundsError(-delta, bal);
    await tx.insert(creditLedger).values({ userId, type: "adjust", delta, balanceAfter, createdBy: adminId, note });
    return balanceAfter;
  });
}
