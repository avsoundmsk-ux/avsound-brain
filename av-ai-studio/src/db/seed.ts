import "dotenv/config";
import { db, schema } from "./index.js";

// Стартовые данные: провайдеры, первая модель Seedance 2.0, правило цены.
async function main() {
  await db.insert(schema.providers).values([
    { id: "modelark", title: "BytePlus ModelArk", enabled: true },
    { id: "kie", title: "KIE.ai (fallback)", enabled: true },
  ]).onConflictDoNothing();

  const [model] = await db.insert(schema.models).values({
    key: "seedance-2",
    title: "Dreamina Seedance 2.0",
    providerId: "modelark",
    providerModelId: "dreamina-seedance-2-0-260128",
    enabled: true,
    meta: { resolutions: ["480p", "720p", "1080p"], minDuration: 4, maxDuration: 15, fps: 24 },
  }).onConflictDoNothing().returning();

  if (model) {
    // Цена клиенту = себестоимость ×2 (multiplier 200 = ×2.00)
    await db.insert(schema.priceRules).values({
      modelId: model.id,
      mode: "text_to_video",
      priceType: "multiplier",
      value: 200,
      enabled: true,
    }).onConflictDoNothing();
    await db.insert(schema.priceRules).values({
      modelId: model.id,
      mode: "image_to_video",
      priceType: "multiplier",
      value: 200,
      enabled: true,
    }).onConflictDoNothing();
  }
  console.log("Seed готов: провайдеры, модель seedance-2, цены ×2 (t2v, i2v).");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
