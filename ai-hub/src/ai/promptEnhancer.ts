import type { GenerationRequest, TaskType } from "./types.js";

// Доп-стиль под AVSound по типу задачи. Усиливает промт, не ломая смысл.
const TASK_STYLE: Record<TaskType, string[]> = {
  car_video: [
    "premium car audio studio", "realistic workshop", "cinematic lighting",
    "clean installation process", "no fake logos unless provided",
    "realistic hands, tools and car interior",
  ],
  ugc_video: [
    "authentic UGC style", "handheld realistic camera", "natural lighting",
    "relatable, genuine, social-media native", "real person, real reactions",
  ],
  social_reel: [
    "dynamic social media reel", "punchy fast cuts", "bold cinematic lighting",
    "high retention hook in first second", "vertical format",
  ],
  talking_person: [
    "realistic talking person", "natural facial expressions and lip movement",
    "soft key light, shallow depth of field", "authentic delivery",
  ],
  product_background: [
    "preserve exact product shape", "do not change the logo",
    "do not alter proportions", "clean dark premium background",
    "ecommerce product photo, studio lighting",
  ],
  product_card: [
    "ecommerce product card", "clean premium background", "sharp focus on product",
    "accurate colors", "no distracting elements",
  ],
  banner: [
    "advertising banner creative", "bold composition", "premium brand look",
    "space for headline text", "high contrast, eye-catching",
  ],
};

const ASPECT_HINT: Record<string, string> = {
  "9:16": "vertical 9:16 social media format",
  "1:1": "1:1 square format",
  "16:9": "16:9 widescreen format",
};

export function enhancePrompt(req: GenerationRequest): string {
  const parts: string[] = [req.prompt.trim()];
  const style = TASK_STYLE[req.task] ?? [];
  if (style.length) parts.push(style.join(", "));
  const ar = req.aspectRatio ?? (req.type === "video" ? "9:16" : "1:1");
  parts.push(ASPECT_HINT[ar]);
  if (req.type === "image" && req.task === "product_background") {
    parts.push("photorealistic, high detail");
  }
  return parts.filter(Boolean).join(". ");
}
