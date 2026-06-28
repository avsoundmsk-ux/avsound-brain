/**
 * TopupService — пополнение баланса (backend only).
 * createIntent: pending-запись (ещё НЕ начисляем).
 * confirm: pending→paid атомарно (защита от двойного начисления) → topupCredits в ledger.
 * dev-confirm заменится на webhook ЮKassa/Stripe (та же confirm-логика).
 */
import { eq, desc, and, sql } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { topupCredits } from "./credits.js";
import { getPackage } from "./packages.js";

const { topups } = schema;
type PayProvider = (typeof schema.payProviderEnum.enumValues)[number];

/** Создать намерение пополнения (pending). Возвращает topup. */
export async function createIntent(userId: string, packageId: string, payProvider: PayProvider = "manual") {
  const pkg = getPackage(packageId);
  if (!pkg) throw new Error("неизвестный пакет");
  const [t] = await db.insert(topups).values({
    userId, payProvider,
    amountMinor: pkg.amountMinor, currency: pkg.currency,
    credits: pkg.credits, status: "pending",
  }).returning();
  return t;
}

/**
 * Подтвердить оплату → начислить кредиты. Идемпотентно:
 * атомарно переводим pending→paid; если строка не обновилась (уже paid) — не начисляем повторно.
 * externalId — id платежа провайдера (для webhook); webhookVerified — прошла ли проверка подписи.
 */
export async function confirmPaid(topupId: string, opts?: { externalId?: string; webhookVerified?: boolean }) {
  const updated = await db.update(topups)
    .set({ status: "paid", paidAt: new Date(), externalId: opts?.externalId, webhookVerified: opts?.webhookVerified ?? false })
    .where(and(eq(topups.id, topupId), eq(topups.status, "pending")))
    .returning();
  if (!updated.length) {
    // уже обработан или не pending — не начисляем повторно
    const [existing] = await db.select().from(topups).where(eq(topups.id, topupId));
    return { credited: false, topup: existing ?? null };
  }
  const t = updated[0];
  const balance = await topupCredits(t.userId, t.credits, t.id, `topup ${t.id}`);
  return { credited: true, topup: t, balance };
}

/** Dev-подтверждение (только не-production). Боевой путь — webhook. */
export async function confirmDev(topupId: string, userId: string) {
  const [t] = await db.select().from(topups).where(eq(topups.id, topupId));
  if (!t) throw new Error("topup не найден");
  if (t.userId !== userId) throw new Error("чужой topup");
  return confirmPaid(topupId, { webhookVerified: false });
}

export async function listTopups(userId: string, limit = 50) {
  return db.select().from(topups).where(eq(topups.userId, userId)).orderBy(desc(topups.createdAt)).limit(limit);
}
