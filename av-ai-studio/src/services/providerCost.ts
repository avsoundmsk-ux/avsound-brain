/**
 * Оценка СЕБЕСТОИМОСТИ генерации в USD (по данным провайдера).
 * Пока для ModelArk Seedance 2.0 (замерено: 5с 720p ≈ 108 900 токенов; $7/M t2v, $4.3/M i2v).
 * Для калькулятора «цена до запуска». Точная цена — по факту после генерации (job.costCredits).
 */
import type { mode as ModeEnum } from "../db/schema.js";

type Res = "480p" | "720p" | "1080p";
type Mode = (typeof ModeEnum.enumValues)[number];

// База: 720p t2v $/сек. Множители по разрешению (относительно 720p).
const BASE_PER_SEC_USD = 0.1525;   // 720p, text-to-video
const BASE_PER_SEC_I2V = 0.0937;   // 720p, image/video-to-video (дешевле)
const RES_FACTOR: Record<Res, number> = { "480p": 0.45, "720p": 1, "1080p": 2.4 };

export function estimateCostUsd(opts: {
  modelKey: string;
  mode: Mode;
  durationSec?: number;
  resolution?: Res;
}): number {
  const dur = Math.max(opts.durationSec ?? 5, 4);
  const res = opts.resolution ?? "720p";
  const isVideo = opts.mode === "text_to_video" || opts.mode === "image_to_video" || opts.mode === "video_to_video";
  if (!isVideo) return 0.04; // картинки — ориентир (nano-banana и т.п.)
  const perSec = (opts.mode === "text_to_video" ? BASE_PER_SEC_USD : BASE_PER_SEC_I2V) * RES_FACTOR[res];
  return +(perSec * dur).toFixed(4);
}
