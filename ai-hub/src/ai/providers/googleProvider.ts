import { BaseProvider } from "./baseProvider.js";
import { GenerationError, ProviderUnavailableError } from "../types.js";
import type { ProviderGenerateInput, ProviderGenerateOutput, ProviderName } from "../types.js";
import { readFile } from "node:fs/promises";

// Google Gemini image (Nano Banana). Картинки/фон/правки. Veo (видео) пока через KIE-fallback.
export class GoogleProvider extends BaseProvider {
  readonly name: ProviderName = "google";

  isAvailable(): boolean {
    return !!this.env("GOOGLE_API_KEY");
  }

  async generate(input: ProviderGenerateInput): Promise<ProviderGenerateOutput> {
    if (!this.isAvailable()) throw new ProviderUnavailableError(this.name, "нет GOOGLE_API_KEY");
    if (input.request.type !== "image") {
      // Veo (видео) — отдельный long-running API; пока отдаём в fallback (KIE).
      throw new GenerationError(this.name, "видео Google (Veo) пока через fallback");
    }
    const parts: any[] = [{ text: input.enhancedPrompt }];
    for (const img of input.request.inputImages ?? []) {
      if (/^https?:\/\//.test(img)) continue; // REST inline ждёт base64
      const buf = await readFile(img);
      const mime = img.endsWith(".png") ? "image/png" : "image/jpeg";
      parts.push({ inline_data: { mime_type: mime, data: buf.toString("base64") } });
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${input.providerModelId}:generateContent?key=${this.env("GOOGLE_API_KEY")}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }] }),
    });
    if (!r.ok) throw new GenerationError(this.name, `HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const j = (await r.json()) as any;
    const out = j?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.data);
    if (!out) throw new GenerationError(this.name, "нет изображения в ответе (возможно фильтр)");
    const mime = out.inlineData.mimeType || "image/png";
    return { outputUrl: `data:${mime};base64,${out.inlineData.data}`, finalPriceUsd: null };
  }
}
