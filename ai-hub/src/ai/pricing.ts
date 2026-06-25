import type { GenerationRequest, ProviderName } from "./types.js";

// Оценка стоимости ДО генерации (USD). Числа — ориентир, уточняются по факту списания.
// Видео считаем по секундам×разрешению; картинки — за штуку.

const KIE_CREDIT_USD = 0.005;

// Ставки KIE для видео: cr/сек по разрешению (Seedance). t2v ставка (выше).
const KIE_VIDEO_CR_PER_SEC: Record<string, number> = { "480p": 19, "720p": 41, "1080p": 102 };

function resForQuality(req: GenerationRequest): "480p" | "720p" | "1080p" {
  if (req.quality === "best") return "1080p";
  if (req.quality === "cheap") return "480p";
  return "720p";
}

// Цена за КАРТИНКУ по (provider, modelId), USD.
const IMAGE_PRICE: Record<string, number> = {
  "google:gemini-2.5-flash-image": 0.039,
  "openai:gpt-image-1": 0.04,
  "kie:google/nano-banana": 0.02,
  "kie:google/nano-banana-edit": 0.02,
  "kie:gpt-image/1-5-text-to-image": 0.04,
  "kie:flux2/pro-text-to-image": 0.03,
};

export function estimatePriceUsd(
  provider: ProviderName,
  providerModelId: string,
  req: GenerationRequest
): number {
  if (req.type === "video") {
    const dur = req.duration ?? 5;
    if (provider === "kie") {
      const rate = KIE_VIDEO_CR_PER_SEC[resForQuality(req)] ?? 41;
      return +(rate * dur * KIE_CREDIT_USD).toFixed(3);
    }
    // modelark/kling/google прямые: ориентир по рынку (уточняется ключом провайдера)
    const perSec = req.quality === "best" ? 0.12 : req.quality === "cheap" ? 0.04 : 0.07;
    return +(perSec * dur).toFixed(3);
  }
  // image
  const key = `${provider}:${providerModelId}`;
  return IMAGE_PRICE[key] ?? 0.04;
}
