import { BaseProvider } from "./baseProvider.js";
import { GenerationError, ProviderUnavailableError } from "../types.js";
import type { ProviderGenerateInput, ProviderGenerateOutput, ProviderName } from "../types.js";

// OpenAI Images (gpt-image-1). Картинки/баннеры/креативы. Возвращает data-URL (base64).
export class OpenAiProvider extends BaseProvider {
  readonly name: ProviderName = "openai";

  isAvailable(): boolean {
    return !!this.env("OPENAI_API_KEY");
  }

  async generate(input: ProviderGenerateInput): Promise<ProviderGenerateOutput> {
    if (!this.isAvailable()) throw new ProviderUnavailableError(this.name, "нет OPENAI_API_KEY");
    if (input.request.type !== "image") {
      throw new GenerationError(this.name, "OpenAI здесь только для изображений");
    }
    const size = input.request.aspectRatio === "16:9" ? "1536x1024"
      : input.request.aspectRatio === "9:16" ? "1024x1536" : "1024x1024";

    const r = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.env("OPENAI_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: input.providerModelId, prompt: input.enhancedPrompt, size, n: 1 }),
    });
    if (!r.ok) throw new GenerationError(this.name, `HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const j = (await r.json()) as { data?: { b64_json?: string; url?: string }[] };
    const item = j.data?.[0];
    if (item?.url) return { outputUrl: item.url, finalPriceUsd: null };
    if (item?.b64_json) return { outputUrl: `data:image/png;base64,${item.b64_json}`, finalPriceUsd: null };
    throw new GenerationError(this.name, "пустой ответ");
  }
}
