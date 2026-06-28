/**
 * Generator — вызов провайдера генерации. Боевой путь: ModelArk Seedance 2.0
 * (проверено: dreamina-seedance-2-0-260128). Возвращает url результата + себестоимость USD.
 * Бросает ошибку при сбое → JobService сделает refund.
 *
 * Инъекция в processJob → в тестах подменяется фейком (без сети).
 */
import { estimateCostUsd } from "../services/providerCost.js";

export interface GenInput {
  providerModelId: string;
  mode: string;
  modelKey: string;
  prompt: string;
  durationSec?: number;
  resolution?: "480p" | "720p" | "1080p";
  aspectRatio?: string;
  inputImages?: string[];
}
export interface GenResult { outputUrl: string; costUsd: number; providerTaskId?: string }
export type Logger = (message: string, data?: unknown) => Promise<void>;
export type Generator = (input: GenInput, log: Logger) => Promise<GenResult>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// fetch с ретраями на сетевые сбои (нестабильный VPN). HTTP-коды не ретраим тут.
async function rfetch(url: string, init?: RequestInit, tries = 4): Promise<Response> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fetch(url, init);
    } catch (e) {
      last = e;
      await sleep(4000);
    }
  }
  throw new Error(`network: ${String((last as Error)?.message ?? last)}`);
}

export const modelArkGenerator: Generator = async (input, log) => {
  const key = process.env.MODELARK_API_KEY;
  const base = (process.env.MODELARK_BASE_URL || "").replace(/\/$/, "");
  if (!key || !base) throw new Error("ModelArk не сконфигурирован (MODELARK_API_KEY/BASE_URL)");

  const res = input.resolution ?? "720p";
  const dur = Math.max(input.durationSec ?? 5, 4);
  const ratio = input.aspectRatio ?? "9:16";
  const text = `${input.prompt} --resolution ${res} --duration ${dur} --ratio ${ratio}`;
  const content: unknown[] = [{ type: "text", text }];
  if (input.inputImages?.[0]) content.push({ type: "image_url", image_url: { url: input.inputImages[0] } });

  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const create = await rfetch(`${base}/api/v3/contents/generations/tasks`, {
    method: "POST", headers, body: JSON.stringify({ model: input.providerModelId, content }),
  });
  if (!create.ok) throw new Error(`ModelArk create HTTP ${create.status}: ${(await create.text()).slice(0, 200)}`);
  const created = (await create.json()) as { id?: string };
  if (!created.id) throw new Error("ModelArk: нет task id");
  await log("modelark task created", { taskId: created.id });

  for (let i = 0; i < 120; i++) {
    const r = await rfetch(`${base}/api/v3/contents/generations/tasks/${created.id}`, { headers });
    const d = (await r.json()) as { status?: string; content?: { video_url?: string }; video_url?: string };
    const st = String(d.status ?? "").toLowerCase();
    if (st === "succeeded" || st === "success") {
      const url = d.content?.video_url || d.video_url;
      if (!url) throw new Error("ModelArk: нет video_url");
      return {
        outputUrl: url,
        providerTaskId: created.id,
        costUsd: estimateCostUsd({ modelKey: input.modelKey, mode: input.mode as never, durationSec: dur, resolution: res }),
      };
    }
    if (st === "failed" || st === "error") throw new Error(`ModelArk task failed: ${JSON.stringify(d).slice(0, 200)}`);
    await sleep(5000);
  }
  throw new Error("ModelArk: таймаут ожидания");
};
