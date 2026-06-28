import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "../src/db/index.js";
import { getBalance } from "../src/services/credits.js";
import { createIntent, confirmDev, listTopups } from "../src/services/topups.js";

const uid = randomUUID();

before(async () => {
  await db.insert(schema.user).values({ id: uid, email: `top_${uid}@x.local`, emailVerified: true });
});

test("intent pending → confirm → ledger topup → идемпотентность", async () => {
  assert.equal(await getBalance(uid), 0);

  const t = await createIntent(uid, "p1000");
  assert.equal(t.status, "pending");
  assert.equal(t.credits, 1000);
  assert.equal(await getBalance(uid), 0); // intent не начисляет

  const r1 = await confirmDev(t.id, uid);
  assert.equal(r1.credited, true);
  assert.equal(await getBalance(uid), 1000);

  // повторное подтверждение — НЕ начисляет второй раз
  const r2 = await confirmDev(t.id, uid);
  assert.equal(r2.credited, false);
  assert.equal(await getBalance(uid), 1000);

  const list = await listTopups(uid);
  assert.equal(list.length, 1);
  assert.equal(list[0].status, "paid");
});

test("чужой topup нельзя подтвердить", async () => {
  const t = await createIntent(uid, "p500");
  await assert.rejects(() => confirmDev(t.id, "someone-else"), /чужой/);
});

test("неизвестный пакет → ошибка", async () => {
  await assert.rejects(() => createIntent(uid, "nope"), /пакет/);
});

after(async () => {
  await db.delete(schema.user).where(eq(schema.user.id, uid));
  process.exit(0);
});
