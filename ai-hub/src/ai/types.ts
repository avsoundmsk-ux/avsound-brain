// Общие типы AI-хаба.

export type MediaType = "image" | "video";

export type TaskType =
  | "product_background"
  | "ugc_video"
  | "car_video"
  | "banner"
  | "social_reel"
  | "talking_person"
  | "product_card";

export type Quality = "cheap" | "balanced" | "best";
export type AspectRatio = "9:16" | "1:1" | "16:9";

export interface GenerationRequest {
  type: MediaType;
  task: TaskType;
  prompt: string;
  inputImages?: string[];
  duration?: number; // секунды (видео)
  aspectRatio?: AspectRatio;
  quality?: Quality; // по умолчанию balanced
  maxPriceUsd?: number;
}

export interface GenerationResult {
  success: boolean;
  provider: string;
  model: string;
  estimatedPriceUsd: number;
  finalPriceUsd: number | null;
  outputUrl: string;
  outputPath?: string;
  metadata: Record<string, unknown>;
}

export type ProviderName = "modelark" | "kie" | "openai" | "google" | "kling";

// Запись реестра моделей.
export interface ModelEntry {
  id: string; // логический id модели в хабе
  type: MediaType;
  providers: ProviderName[]; // приоритет провайдеров (слева — предпочтительнее)
  bestFor: TaskType[];
  qualityTier: 1 | 2 | 3; // 1 cheap, 2 balanced, 3 best
  // id модели у конкретного провайдера
  providerModelIds: Partial<Record<ProviderName, string>>;
}

export interface ProviderGenerateInput {
  providerModelId: string;
  request: GenerationRequest;
  enhancedPrompt: string;
}

export interface ProviderGenerateOutput {
  outputUrl: string; // удалённый URL результата
  finalPriceUsd: number | null; // фактическая цена, если провайдер её отдаёт
  raw?: unknown;
}

export interface Provider {
  readonly name: ProviderName;
  /** Готов ли провайдер (есть ключ/конфиг). */
  isAvailable(): boolean;
  /** Запуск генерации. Бросает ProviderUnavailableError/GenerationError при проблемах. */
  generate(input: ProviderGenerateInput): Promise<ProviderGenerateOutput>;
}

export class ProviderUnavailableError extends Error {
  constructor(public providerName: string, message: string) {
    super(`[${providerName}] недоступен: ${message}`);
    this.name = "ProviderUnavailableError";
  }
}

export class GenerationError extends Error {
  constructor(public providerName: string, message: string) {
    super(`[${providerName}] ошибка генерации: ${message}`);
    this.name = "GenerationError";
  }
}
