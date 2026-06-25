import { test } from "node:test";
import assert from "node:assert/strict";
import { AiRouter } from "../src/ai/aiRouter.js";
import { GenerationError } from "../src/ai/types.js";
import type { Provider, ProviderGenerateInput, ProviderGenerateOutput, ProviderName } from "../src/ai/types.js";

// Фейк-провайдер: управляем доступностью и поведением (без сети).
class Fake implements Provider {
  constructor(public readonly name: ProviderName, private opts: { available: boolean; fail?: boolean }) {}
  isAvailable() { return this.opts.available; }
  async generate(input: ProviderGenerateInput): Promise<ProviderGenerateOutput> {
    if (this.opts.fail) throw new GenerationError(this.name, "симуляция ошибки API");
    const ext = input.request.type === "video" ? "mp4" : "png";
    return { outputUrl: `https://fake/${this.name}.${ext}`, finalPriceUsd: 0.5, raw: { fake: true } };
  }
}

function makeRouter(avail: Partial<Record<ProviderName, { available: boolean; fail?: boolean }>>) {
  const names: ProviderName[] = ["modelark", "kie", "openai", "google", "kling"];
  const providers = names.map((n) => new Fake(n, avail[n] ?? { available: false }));
  const calls: any[] = [];
  const router = new AiRouter({
    providers,
    save: async (url: string, id: string) => ({ path: `/tmp/${id}`, publicUrl: `pub/${id}` }),
    history: async (e) => { calls.push(e); },
  });
  return { router, calls };
}

test("Сценарий 1: UGC-видео через Seedance (modelark)", async () => {
  const { router } = makeRouter({ modelark: { available: true } });
  const res = await router.generate({
    type: "video", task: "ugc_video", prompt: "девушка распаковывает сабвуфер",
    duration: 5, aspectRatio: "9:16", quality: "cheap",
  });
  assert.equal(res.success, true);
  assert.equal(res.provider, "modelark");
  assert.equal(res.model, "seedance-2");
  assert.ok(res.outputUrl.startsWith("pub/"));
});

test("Сценарий 2: замена фона товара (image → google)", async () => {
  const { router } = makeRouter({ google: { available: true } });
  const res = await router.generate({
    type: "image", task: "product_background",
    prompt: "сабвуфер на чистом тёмном фоне", inputImages: ["http://x/sub.jpg"],
    aspectRatio: "1:1", quality: "balanced",
  });
  assert.equal(res.success, true);
  assert.equal(res.provider, "google");
  assert.equal(res.model, "nano-banana-edit");
});

test("Сценарий 3: fallback modelark→kie при сбое", async () => {
  const { router } = makeRouter({
    modelark: { available: true, fail: true }, // прямой провайдер падает
    kie: { available: true },                  // fallback срабатывает
  });
  const res = await router.generate({
    type: "video", task: "car_video", prompt: "установка усилителя в багажник",
    duration: 6, quality: "cheap",
  });
  assert.equal(res.success, true);
  assert.equal(res.provider, "kie");
  const attempts = (res.metadata as any).attempts as { provider: string; ok: boolean }[];
  assert.ok(attempts.some((a) => a.provider === "modelark" && !a.ok), "modelark должен быть в попытках со сбоем");
});

test("Оценка цены до генерации", () => {
  const { router } = makeRouter({ kie: { available: true } });
  const est = router.estimate({ type: "video", task: "ugc_video", prompt: "x", duration: 5, quality: "cheap" });
  assert.ok(est && est.estimatedPriceUsd > 0);
});

test("Пустой prompt → ошибка", async () => {
  const { router } = makeRouter({ kie: { available: true } });
  await assert.rejects(() => router.generate({ type: "image", task: "banner", prompt: "  " }));
});
