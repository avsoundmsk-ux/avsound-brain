/**
 * Storage abstraction — кладём результат генерации в своё хранилище (R2/S3),
 * чтобы ссылка не протухала (provider-url временный).
 * Нет env R2 → isConfigured()=false → fallback на provider-url (job не падает).
 */
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export interface Storage {
  isConfigured(): boolean;
  upload(key: string, bytes: Buffer, contentType: string): Promise<string>; // → public url
}

export class S3Storage implements Storage {
  isConfigured(): boolean {
    return !!(process.env.S3_ENDPOINT && process.env.S3_BUCKET && process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY && process.env.S3_PUBLIC_BASE);
  }
  private client() {
    return new S3Client({
      region: "auto",
      endpoint: process.env.S3_ENDPOINT,
      credentials: { accessKeyId: process.env.S3_ACCESS_KEY!, secretAccessKey: process.env.S3_SECRET_KEY! },
      forcePathStyle: true,
    });
  }
  async upload(key: string, bytes: Buffer, contentType: string): Promise<string> {
    await this.client().send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!, Key: key, Body: bytes, ContentType: contentType,
    }));
    return `${process.env.S3_PUBLIC_BASE!.replace(/\/$/, "")}/${key}`;
  }
}

export const defaultStorage: Storage = new S3Storage();

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0 Safari/537.36";

function contentTypeFor(url: string): { ct: string; ext: string } {
  const m = url.match(/\.(mp4|webm|png|jpg|jpeg|webp|mp3|wav)(?:\?|$)/i);
  const ext = (m?.[1] || "mp4").toLowerCase();
  const map: Record<string, string> = {
    mp4: "video/mp4", webm: "video/webm", png: "image/png", jpg: "image/jpeg",
    jpeg: "image/jpeg", webp: "image/webp", mp3: "audio/mpeg", wav: "audio/wav",
  };
  return { ct: map[ext] ?? "application/octet-stream", ext };
}

/**
 * Скачать provider-url и положить в storage. Возвращает стабильный url.
 * Storage не настроен/упал — возвращает provider-url (fallback), не бросает.
 */
export async function persistResult(
  providerUrl: string,
  jobId: string,
  log: (m: string, d?: unknown, level?: string) => Promise<void>,
  storage: Storage = defaultStorage,
): Promise<{ url: string; stored: boolean }> {
  if (!storage.isConfigured()) {
    await log("storage не настроен → fallback provider-url");
    return { url: providerUrl, stored: false };
  }
  try {
    await log("download start", { providerUrl });
    const r = await fetch(providerUrl, { headers: { "User-Agent": UA } });
    if (!r.ok) throw new Error(`download HTTP ${r.status}`);
    const bytes = Buffer.from(await r.arrayBuffer());
    const { ct, ext } = contentTypeFor(providerUrl);
    const key = `generations/${jobId}.${ext}`;
    await log("upload start", { key, size: bytes.length });
    const url = await storage.upload(key, bytes, ct);
    await log("upload done", { url });
    return { url, stored: true };
  } catch (e) {
    await log("storage failed → fallback provider-url", { error: (e as Error).message }, "warn");
    return { url: providerUrl, stored: false };
  }
}
