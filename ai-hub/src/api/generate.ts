import { Router } from "express";
import { AiRouter } from "../ai/aiRouter.js";
import { listHistory } from "../storage/generationHistory.js";
import type { GenerationRequest } from "../ai/types.js";

export function generateRouter(ai = new AiRouter()): Router {
  const r = Router();

  // Предварительная оценка цены без генерации.
  r.post("/estimate", (req, res) => {
    const est = ai.estimate(req.body as GenerationRequest);
    if (!est) return res.status(400).json({ success: false, error: "нет подходящего провайдера" });
    res.json({ success: true, ...est });
  });

  // Основная генерация.
  r.post("/generate", async (req, res) => {
    try {
      const body = req.body as GenerationRequest;
      const result = await ai.generate(body);
      res.json({
        success: true,
        provider: result.provider,
        model: result.model,
        estimatedPriceUsd: result.estimatedPriceUsd,
        finalPriceUsd: result.finalPriceUsd,
        outputUrl: result.outputUrl,
        metadata: result.metadata,
      });
    } catch (e) {
      res.status(502).json({ success: false, error: (e as Error).message });
    }
  });

  r.get("/history", async (_req, res) => res.json(await listHistory()));

  return r;
}
