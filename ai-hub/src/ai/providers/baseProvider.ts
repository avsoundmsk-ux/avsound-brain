import type { Provider, ProviderGenerateInput, ProviderGenerateOutput, ProviderName } from "../types.js";

export abstract class BaseProvider implements Provider {
  abstract readonly name: ProviderName;

  /** Значение env-переменной или undefined, если пусто. Ключи — только из окружения. */
  protected env(key: string): string | undefined {
    const v = process.env[key];
    return v && v.trim() ? v.trim() : undefined;
  }

  abstract isAvailable(): boolean;
  abstract generate(input: ProviderGenerateInput): Promise<ProviderGenerateOutput>;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
