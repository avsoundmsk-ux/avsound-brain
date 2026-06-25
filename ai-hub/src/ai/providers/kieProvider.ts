import { BaseProvider, sleep } from "./baseProvider.js";
import { GenerationError, ProviderUnavailableError } from "../types.js";
import type { ProviderGenerateInput, ProviderGenerateOutput, ProviderName } from "../types.js";
import { readFile } from "node:fs/promises";

const BASE = "https://api.kie.ai/api/v1/jobs";
const UPLOAD = "https://kieai.redpandaai.co/api/file-base64-upload";
const CREDIT = "https://api.kie.ai/api/v1/chat/credit";
const CREDIT_USD = 0.005;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0 Safari/537.36";

// Универсальный провайдер KIE (jobs API). Боевой — проверен.
export class KieProvider extends BaseProvider {
  readonly name: ProviderName = "kie";

  isAvailable(): boolean {
    return !!this.env("KIE_API_KEY");
  }

  private headers() {
    return {
      Authorization: `Bearer ${this.env("KIE_API_KEY")}`,
      "Content-Type": "application/json",
      "User-Agent": UA,
    };
  }

  private async balance(): Promise<number | null> {
    try {
      const r = await fetch(CREDIT, { headers: this.headers() });
      const j = (await r.json()) as { data?: number };
      return typeof j.data === "number" ? j.data : null;
    } catch {
      return null;
    }
  }

  private async upload(pathOrUrl: string): Promise<string> {
    if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;
    const buf = await readFile(pathOrUrl);
    const mime = pathOrUrl.endsWith(".png") ? "image/png" : "image/jpeg";
    const body = {
      base64Data: `data:${mime};base64,${buf.toString("base64")}`,
      uploadPath: "avsound/aihub",
      fileName: pathOrUrl.split(/[\\/]/).pop(),
    };
    const r = await fetch(UPLOAD, { method: "POST", headers: this.headers(), body: JSON.stringify(body) });
    const j = (await r.json()) as { data?: { downloadUrl?: string } };
    const url = j?.data?.downloadUrl;
    if (!url) throw new GenerationError(this.name, "upload не вернул URL");
    return url;
  }

  async generate(input: ProviderGenerateInput): Promise<ProviderGenerateOutput> {
    if (!this.isAvailable()) throw new ProviderUnavailableError(this.name, "нет KIE_API_KEY");
    const { providerModelId, request, enhancedPrompt } = input;

    const inp: Record<string, unknown> = { prompt: enhancedPrompt };
    const isVideo = request.type === "video";
    const images = request.inputImages ?? [];

    if (images.length) {
      const urls = await Promise.all(images.map((i) => this.upload(i)));
      if (isVideo) inp.first_frame_url = urls[0];
      else inp.image_urls = urls;
    }
    if (isVideo) {
      inp.resolution = request.quality === "best" ? "1080p" : request.quality === "cheap" ? "480p" : "720p";
      inp.aspect_ratio = request.aspectRatio ?? "9:16";
      inp.duration = request.duration ?? 5;
    } else {
      inp.output_format = "png";
    }

    const before = await this.balance();
    const createRes = await fetch(`${BASE}/createTask`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ model: providerModelId, input: inp }),
    });
    const created = (await createRes.json()) as { code?: number; msg?: string; data?: { taskId?: string } };
    const taskId = created?.data?.taskId;
    if (!taskId) throw new GenerationError(this.name, created?.msg || `createTask: ${JSON.stringify(created)}`);

    // poll
    let url: string | null = null;
    for (let i = 0; i < 120; i++) {
      const r = await fetch(`${BASE}/recordInfo?taskId=${taskId}`, { headers: this.headers() });
      const d = ((await r.json()) as { data?: any }).data ?? {};
      const state = String(d.state ?? "").toLowerCase();
      if (["success", "completed", "succeed"].includes(state)) {
        url = extractUrl(d);
        break;
      }
      if (["fail", "failed", "error"].includes(state)) {
        throw new GenerationError(this.name, `генерация упала: ${JSON.stringify(d).slice(0, 300)}`);
      }
      await sleep(5000);
    }
    if (!url) throw new GenerationError(this.name, "таймаут/URL не найден");

    const after = await this.balance();
    const finalPriceUsd = before != null && after != null ? +((before - after) * CREDIT_USD).toFixed(3) : null;
    return { outputUrl: url, finalPriceUsd, raw: { taskId } };
  }
}

function extractUrl(d: any): string | null {
  const rj = d?.resultJson;
  if (typeof rj === "string") {
    try {
      const o = JSON.parse(rj);
      const urls = o.resultUrls || o.urls;
      if (urls?.length) return urls[0];
    } catch { /* ignore */ }
  }
  const m = JSON.stringify(d).match(/https?:\/\/[^\s"']+\.(mp4|png|jpg|jpeg|webp|mp3|wav)/);
  return m ? m[0] : null;
}
