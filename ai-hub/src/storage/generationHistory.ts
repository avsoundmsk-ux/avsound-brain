import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const FILE = path.resolve("./data/generations.json");

export interface HistoryEntry {
  id: string;
  createdAt: string;
  type: string;
  task: string;
  prompt: string;
  enhancedPrompt: string;
  provider: string;
  model: string;
  estimatedPriceUsd: number;
  finalPriceUsd: number | null;
  outputUrl: string;
  outputPath?: string;
  success: boolean;
  error?: string;
  attempts: { provider: string; model: string; ok: boolean; error?: string }[];
}

export async function appendHistory(entry: HistoryEntry): Promise<void> {
  await mkdir(path.dirname(FILE), { recursive: true });
  const list = await listHistory();
  list.unshift(entry);
  await writeFile(FILE, JSON.stringify(list.slice(0, 500), null, 2));
}

export async function listHistory(): Promise<HistoryEntry[]> {
  try {
    return JSON.parse(await readFile(FILE, "utf8")) as HistoryEntry[];
  } catch {
    return [];
  }
}
