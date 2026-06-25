import { BaseProvider, sleep } from "./baseProvider.js";
import { GenerationError, ProviderUnavailableError } from "../types.js";
import type { ProviderGenerateInput, ProviderGenerateOutput, ProviderName } from "../types.js";

/**
 * Kling API — видео с людьми / UGC / говорящие персонажи / сложное движение.
 * Ключ из env (KLING_API_KEY). Реальный интерфейс: создать задачу → опрос → URL.
 * При ошибке/недоступности — GenerationError → router уходит в KIE-fallback (kling через KIE).
 */
export class KlingProvider extends BaseProvider {
  readonly name: ProviderName = "kling";

  isAvailable(): boolean {
    return !!this.env("KLING_API_KEY");
  }

  async generate(input: ProviderGenerateInput): Promise<ProviderGenerateOutput> {
    if (!this.isAvailable()) throw new ProviderUnavailableError(this.name, "нет KLING_API_KEY");
    if (input.request.type !== "video") {
      throw new GenerationError(this.name, "Kling используем для видео");
    }
    const headers = {
      Authorization: `Bearer ${this.env("KLING_API_KEY")}`,
      "Content-Type": "application/json",
    };
    const body: Record<string, unknown> = {
      model_name: input.providerModelId,
      prompt: input.enhancedPrompt,
      aspect_ratio: input.request.aspectRatio ?? "9:16",
      duration: String(input.request.duration ?? 5),
    };
    if (input.request.inputImages?.[0]) body.image = input.request.inputImages[0];

    const create = await fetch("https://api.klingai.com/v1/videos/text2video", {
      method: "POST", headers, body: JSON.stringify(body),
    });
    if (!create.ok) throw new GenerationError(this.name, `create HTTP ${create.status}: ${(await create.text()).slice(0, 200)}`);
    const created = (await create.json()) as any;
    const taskId = created?.data?.task_id;
    if (!taskId) throw new GenerationError(this.name, "нет task_id");

    for (let i = 0; i < 120; i++) {
      const r = await fetch(`https://api.klingai.com/v1/videos/text2video/${taskId}`, { headers });
      const d = (await r.json()) as any;
      const status = String(d?.data?.task_status ?? "").toLowerCase();
      if (status === "succeed" || status === "succeeded") {
        const url = d?.data?.task_result?.videos?.[0]?.url;
        if (!url) throw new GenerationError(this.name, "нет url результата");
        return { outputUrl: url, finalPriceUsd: null, raw: { taskId } };
      }
      if (status === "failed") throw new GenerationError(this.name, "task failed");
      await sleep(5000);
    }
    throw new GenerationError(this.name, "таймаут ожидания");
  }
}
