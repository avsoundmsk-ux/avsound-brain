import "dotenv/config";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { quote, computePrice, costToCredits } from "../src/services/pricing.js";
import * as credits from "../src/services/credits.js";
import { db, schema } from "../src/db/index.js";
import { eq } from "drizzle-orm";

// ---- PricingService (pure) ----
test("цена: multiplier ×2", () => {
  assert.equal(computePrice(100, { priceType: "multiplier", value: 200 }), 200);
});
test("цена: markup +50", () => {
  assert.equal(computePrice(100, { priceType: "markup", value: 50 }), 150);
});
test("цена: fixed 300", () => {
  assert.equal(computePrice(100, { priceType: "fixed", value: 300 }), 300);
});
test("котировка из USD", () => {
  const q = quote(2.29, { priceType: "multiplier", value: 200 }); // $2.29 → 229 cr → ×2 = 458
  assert.equal(q.costCredits, 229);
  assert.equal(q.priceCredits, 458);
  assert.equal(q.profitCredits, 229);
});

// ---- CreditService (integration, live Neon) ----
const uid = randomUUID();
const jobId = randomUUID();

test("кредиты: topup → hold → refund", async () => {
  await db.insert(schema.user).values({ id: uid, email: `test_${uid}@x.local`, emailVerified: true });

  assert.equal(await credits.getBalance(uid), 0);
  await credits.topupCredits(uid, 500, randomUUID());
  assert.equal(await credits.getBalance(uid), 500);

  await credits.hold(uid, 300, jobId);
  assert.equal(await credits.getBalance(uid), 200);

  // не хватает на ещё 300
  await assert.rejects(() => credits.hold(uid, 300, randomUUID()), (e) => e instanceof credits.InsufficientFundsError);

  // возврат первого hold
  await credits.refund(uid, 300, jobId);
  assert.equal(await credits.getBalance(uid), 500);

  // повторный refund идемпотентен
  await credits.refund(uid, 300, jobId);
  assert.equal(await credits.getBalance(uid), 500);
});

after(async () => {
  await db.delete(schema.user).where(eq(schema.user.id, uid)); // cascade чистит ledger
  process.exit(0);
});
