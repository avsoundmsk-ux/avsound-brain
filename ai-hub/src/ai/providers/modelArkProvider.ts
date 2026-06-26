import { BaseProvider, sleep } from "./baseProvider.js";
import { GenerationError, ProviderUnavailableError } from "../types.js";
import type { ProviderGenerateInput, ProviderGenerateOutput, ProviderName } from "../types.js";

/**
 * ModelArk / BytePlus (Seedance 2.0 напрямую) — основной путь для видео.
 * Базовый URL и ключ — из env (MODELARK_BASE_URL, MODELARK_API_KEY).
 * Эндпоинт BytePlus Ark для видео-задач — content-generation tasks; формат может
 * отличаться по региону, поэтому при любой ошибке бросаем GenerationError → router
 * переключится на KIE (fallback). Это рабочий интерфейс, не заглушка: при верном
 * ключе/URL запрос уходит реально.
 */
export class ModelArkProvider extends BaseProvider {
  readonly name: ProviderName = "modelark";

  isAvailable(): boolean {
    return !!this.env("MODELARK_API_KEY") && !!this.env("MODELARK_BASE_URL");
  }

  async generate(input: ProviderGenerateInput): Promise<ProviderGenerateOutput> {
    if (!this.isAvailable()) throw new ProviderUnavailableError(this.name, "нет MODELARK_API_KEY/MODELARK_BASE_URL");
    if (input.request.type !== "video") {
      throw new GenerationError(this.name, "ModelArk используем для видео");
    }
    const base = this.env("MODELARK_BASE_URL")!.replace(/\/$/, "");
    const headers = {
      Authorization: `Bearer ${this.env("MODELARK_API_KEY")}`,
      "Content-Type": "application/json",
    };
    // Ark Seedance принимает параметры внутри текста: --resolution --duration --ratio
    const res = input.request.quality === "best" ? "1080p" : input.request.quality === "cheap" ? "480p" : "720p";
    const dur = Math.max(input.request.duration ?? 5, 4); // мин 4с
    const ratio = input.request.aspectRatio ?? "9:16";
    const text = `${input.enhancedPrompt} --resolution ${res} --duration ${dur} --ratio ${ratio}`;
    const body = {
      model: input.providerModelId,
      content: [
        { type: "text", text },
        ...(input.request.inputImages?.[0]
          ? [{ type: "image_url", image_url: { url: input.request.inputImages[0] } }]
          : []),
      ],
    };

    const create = await fetch(`${base}/api/v3/contents/generations/tasks`, {
      method: "POST", headers, body: JSON.stringify(body),
    });
    if (!create.ok) throw new GenerationError(this.name, `create HTTP ${create.status}: ${(await create.text()).slice(0, 200)}`);
    const created = (await create.json()) as { id?: string };
    if (!created.id) throw new GenerationError(this.name, "нет task id");

    for (let i = 0; i < 120; i++) {
      const r = await fetch(`${base}/api/v3/contents/generations/tasks/${created.id}`, { headers });
      const d = (await r.json()) as any;
      const status = String(d.status ?? "").toLowerCase();
      if (status === "succeeded" || status === "success") {
        const url = d?.content?.video_url || d?.video_url;
        if (!url) throw new GenerationError(this.name, "нет video_url в ответе");
        return { outputUrl: url, finalPriceUsd: null, raw: { id: created.id } };
      }
      if (status === "failed" || status === "error") {
        throw new GenerationError(this.name, `task failed: ${JSON.stringify(d).slice(0, 200)}`);
      }
      await sleep(5000);
    }
    throw new GenerationError(this.name, "таймаут ожидания");
  }
}
