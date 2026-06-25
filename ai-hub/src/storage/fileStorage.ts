import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0 Safari/537.36";

function storageDir(): string {
  return path.resolve(process.env.STORAGE_PATH || "./data/output");
}

function publicBase(): string {
  return (process.env.PUBLIC_BASE_URL || "http://localhost:3002").replace(/\/$/, "");
}

function extFromUrl(url: string): string {
  if (url.startsWith("data:")) {
    const m = url.match(/^data:([^;]+);/);
    const mime = m?.[1] || "image/png";
    return (mime.split("/")[1] || "png").replace("jpeg", "jpg");
  }
  const m = url.match(/\.(mp4|png|jpg|jpeg|webp|mp3|wav|gif)(?:\?|$)/i);
  return m ? m[1].toLowerCase() : "bin";
}

/** Сохраняет результат (http-URL или data-URL) локально. Возвращает путь и публичный URL. */
export async function saveOutput(outputUrl: string, id: string): Promise<{ path: string; publicUrl: string }> {
  const dir = storageDir();
  await mkdir(dir, { recursive: true });
  const ext = extFromUrl(outputUrl);
  const filename = `${id}.${ext}`;
  const filePath = path.join(dir, filename);

  let bytes: Buffer;
  if (outputUrl.startsWith("data:")) {
    bytes = Buffer.from(outputUrl.split(",")[1] ?? "", "base64");
  } else {
    let lastErr: unknown;
    bytes = await (async () => {
      for (let i = 0; i < 5; i++) {
        try {
          const r = await fetch(outputUrl, { headers: { "User-Agent": UA } });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return Buffer.from(await r.arrayBuffer());
        } catch (e) {
          lastErr = e;
          await new Promise((res) => setTimeout(res, 4000));
        }
      }
      throw new Error(`download failed: ${String(lastErr).slice(0, 120)}`);
    })();
  }
  await writeFile(filePath, bytes);
  return { path: filePath, publicUrl: `${publicBase()}/files/${filename}` };
}
