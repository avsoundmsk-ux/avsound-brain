import { modelsForTask } from "./modelRegistry.js";
import { estimatePriceUsd } from "./pricing.js";
import { enhancePrompt } from "./promptEnhancer.js";
import { GenerationError } from "./types.js";
import type { GenerationRequest, GenerationResult, Provider, ProviderName } from "./types.js";

import { KieProvider } from "./providers/kieProvider.js";
import { ModelArkProvider } from "./providers/modelArkProvider.js";
import { OpenAiProvider } from "./providers/openAiProvider.js";
import { GoogleProvider } from "./providers/googleProvider.js";
import { KlingProvider } from "./providers/klingProvider.js";

import { saveOutput } from "../storage/fileStorage.js";
import { appendHistory, type HistoryEntry } from "../storage/generationHistory.js";

interface Candidate {
  modelId: string;
  provider: ProviderName;
  providerModelId: string;
  qualityTier: number;
  est: number;
}

export interface RouterDeps {
  providers: Provider[];
  save: typeof saveOutput;
  history: (e: HistoryEntry) => Promise<void>;
}

export class AiRouter {
  private providers = new Map<ProviderName, Provider>();
  private save: typeof saveOutput;
  private history: (e: HistoryEntry) => Promise<void>;

  constructor(deps?: Partial<RouterDeps>) {
    const list = deps?.providers ?? [
      new ModelArkProvider(), new KieProvider(), new OpenAiProvider(),
      new GoogleProvider(), new KlingProvider(),
    ];
    for (const p of list) this.providers.set(p.name, p);
    this.save = deps?.save ?? saveOutput;
    this.history = deps?.history ?? appendHistory;
  }

  /** Упорядоченный список кандидатов (модель+провайдер) под задачу и качество. */
  plan(req: GenerationRequest): Candidate[] {
    const models = modelsForTask(req.type, req.task);
    const cands: Candidate[] = [];
    for (const m of models) {
      for (const prov of m.providers) {
        const pmid = m.providerModelIds[prov];
        if (!pmid) continue;
        cands.push({
          modelId: m.id, provider: prov, providerModelId: pmid,
          qualityTier: m.qualityTier, est: estimatePriceUsd(prov, pmid, req),
        });
      }
    }
    const q = req.quality ?? "balanced";
    cands.sort((a, b) => {
      if (q === "cheap") return a.est - b.est;
      if (q === "best") return b.qualityTier - a.qualityTier || a.est - b.est;
      // balanced: качество минус штраф за цену
      return (b.qualityTier - b.est * 2) - (a.qualityTier - a.est * 2);
    });
    return req.maxPriceUsd != null ? cands.filter((c) => c.est <= req.maxPriceUsd!) : cands;
  }

  /** Предварительная оценка без генерации. */
  estimate(req: GenerationRequest) {
    const first = this.plan(req)[0];
    if (!first) return null;
    return { provider: first.provider, model: first.modelId, estimatedPriceUsd: first.est };
  }

  async generate(req: GenerationRequest): Promise<GenerationResult> {
    if (!req.prompt?.trim()) throw new GenerationError("router", "пустой prompt");
    const cands = this.plan(req);
    if (!cands.length) throw new GenerationError("router", "нет подходящей модели/провайдера (проверь maxPriceUsd)");

    const enhancedPrompt = enhancePrompt(req);
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const attempts: HistoryEntry["attempts"] = [];

    for (const c of cands) {
      const prov = this.providers.get(c.provider);
      if (!prov || !prov.isAvailable()) {
        attempts.push({ provider: c.provider, model: c.modelId, ok: false, error: "недоступен (нет ключа)" });
        continue;
      }
      try {
        const out = await prov.generate({ providerModelId: c.providerModelId, request: req, enhancedPrompt });
        const saved = await this.save(out.outputUrl, id);
        const result: GenerationResult = {
          success: true,
          provider: c.provider,
          model: c.modelId,
          estimatedPriceUsd: c.est,
          finalPriceUsd: out.finalPriceUsd ?? c.est,
          outputUrl: saved.publicUrl,
          outputPath: saved.path,
          metadata: { id, providerModelId: c.providerModelId, enhancedPrompt, raw: out.raw, attempts },
        };
        attempts.push({ provider: c.provider, model: c.modelId, ok: true });
        await this.history(toHistory(id, req, enhancedPrompt, result, attempts));
        return result;
      } catch (e) {
        attempts.push({ provider: c.provider, model: c.modelId, ok: false, error: String((e as Error).message).slice(0, 160) });
        // fallback → следующий кандидат
      }
    }
    const failed: HistoryEntry = {
      id, createdAt: new Date().toISOString(), type: req.type, task: req.task,
      prompt: req.prompt, enhancedPrompt, provider: "-", model: "-",
      estimatedPriceUsd: cands[0]?.est ?? 0, finalPriceUsd: null, outputUrl: "",
      success: false, error: "все провайдеры не справились", attempts,
    };
    await this.history(failed);
    throw new GenerationError("router", `все провайдеры не справились: ${JSON.stringify(attempts)}`);
  }
}

function toHistory(
  id: string, req: GenerationRequest, enhancedPrompt: string,
  r: GenerationResult, attempts: HistoryEntry["attempts"]
): HistoryEntry {
  return {
    id, createdAt: new Date().toISOString(), type: req.type, task: req.task,
    prompt: req.prompt, enhancedPrompt, provider: r.provider, model: r.model,
    estimatedPriceUsd: r.estimatedPriceUsd, finalPriceUsd: r.finalPriceUsd,
    outputUrl: r.outputUrl, outputPath: r.outputPath, success: true, attempts,
  };
}
