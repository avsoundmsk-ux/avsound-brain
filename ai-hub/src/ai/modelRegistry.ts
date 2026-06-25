import type { ModelEntry } from "./types.js";

// Реестр моделей. providers — в порядке предпочтения (modelark прямой → kie fallback).
export const MODEL_REGISTRY: ModelEntry[] = [
  {
    id: "seedance-2",
    type: "video",
    providers: ["modelark", "kie"],
    bestFor: ["ugc_video", "car_video", "social_reel"],
    qualityTier: 2,
    providerModelIds: { modelark: "seedance-2-0", kie: "bytedance/seedance-2" },
  },
  {
    id: "seedance-2-fast",
    type: "video",
    providers: ["modelark", "kie"],
    bestFor: ["ugc_video", "social_reel", "car_video"],
    qualityTier: 1,
    providerModelIds: { modelark: "seedance-2-0-fast", kie: "bytedance/seedance-2-fast" },
  },
  {
    id: "kling-v3",
    type: "video",
    providers: ["kling", "kie"],
    bestFor: ["talking_person", "ugc_video", "social_reel"],
    qualityTier: 3,
    providerModelIds: { kling: "kling-v3", kie: "kling/v3-turbo-image-to-video" },
  },
  {
    id: "veo",
    type: "video",
    providers: ["google", "kie"],
    bestFor: ["car_video", "ugc_video"],
    qualityTier: 3,
    providerModelIds: { google: "veo-3.0", kie: "veo/veo3" },
  },
  {
    id: "nano-banana",
    type: "image",
    providers: ["google", "kie"],
    bestFor: ["product_card", "banner"],
    qualityTier: 2,
    providerModelIds: { google: "gemini-2.5-flash-image", kie: "google/nano-banana" },
  },
  {
    id: "nano-banana-edit",
    type: "image",
    providers: ["google", "kie"],
    bestFor: ["product_background", "product_card"],
    qualityTier: 2,
    providerModelIds: { google: "gemini-2.5-flash-image", kie: "google/nano-banana-edit" },
  },
  {
    id: "gpt-image",
    type: "image",
    providers: ["openai", "kie"],
    bestFor: ["banner", "product_background"],
    qualityTier: 3,
    providerModelIds: { openai: "gpt-image-1", kie: "gpt-image/1-5-text-to-image" },
  },
  {
    id: "flux",
    type: "image",
    providers: ["kie"],
    bestFor: ["banner", "product_card"],
    qualityTier: 2,
    providerModelIds: { kie: "flux2/pro-text-to-image" },
  },
];

export function modelsForTask(type: ModelEntry["type"], task: string): ModelEntry[] {
  const exact = MODEL_REGISTRY.filter((m) => m.type === type && m.bestFor.includes(task as any));
  return exact.length ? exact : MODEL_REGISTRY.filter((m) => m.type === type);
}
