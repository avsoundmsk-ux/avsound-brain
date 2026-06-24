/**
 * services/nanobanana — интеграция Nano Banana (Gemini image) через официальный @google/genai.
 *
 * Экспорт:
 *   generateImage()       — текст → картинка (опц. входное фото).
 *   editImage()           — фото + текст → отредактированная картинка.
 *   getGenerationStatus() — статус генерации по id (история).
 *   saveGeneration()      — сохранить картинку на диск + запись в историю.
 *
 * Генерация у Gemini синхронная — статус становится 'done' сразу после ответа.
 * Клиент инжектится параметром `client` (для тестов без сети).
 */
import { GoogleGenAI } from '@google/genai';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../data');
const IMAGES_DIR = path.join(DATA_DIR, 'images');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

export const DEFAULT_MODEL = process.env.NANO_BANANA_MODEL || 'gemini-2.5-flash-image';

// ---------- логирование ----------
export function logError(scope, err) {
  const line = `[${new Date().toISOString()}] [nanobanana:${scope}] ${err?.code || ''} ${err?.message || err}`;
  console.error(line);
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.appendFileSync(path.join(DATA_DIR, 'errors.log'), line + '\n');
  } catch { /* лог не критичен */ }
}

// ---------- клиент ----------
let _client;
export function getClient() {
  if (!_client) {
    if (!process.env.GOOGLE_API_KEY) {
      const e = new Error('GOOGLE_API_KEY не задан в окружении');
      e.code = 'NO_API_KEY';
      throw e;
    }
    _client = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
  }
  return _client;
}

// ---------- ошибки / лимиты ----------
function normalizeError(err) {
  const msg = String(err?.message || err || '');
  const status = err?.status || err?.code || (msg.match(/\b(\d{3})\b/) || [])[1];
  const e = new Error(msg);
  if (status == 429 || /RESOURCE_EXHAUSTED|rate.?limit|quota/i.test(msg)) {
    e.code = 'RATE_LIMIT';
    e.message = 'Превышен лимит API Gemini. Подожди и повтори, или проверь квоту.';
  } else if (status == 401 || status == 403 || /API key|permission/i.test(msg)) {
    e.code = 'AUTH';
    e.message = 'Ошибка авторизации Gemini. Проверь GOOGLE_API_KEY.';
  } else {
    e.code = 'API_ERROR';
  }
  e.original = msg;
  return e;
}

function extractImage(resp) {
  const parts = resp?.candidates?.[0]?.content?.parts || [];
  for (const p of parts) {
    if (p.inlineData?.data) {
      return { data: p.inlineData.data, mimeType: p.inlineData.mimeType || 'image/png' };
    }
  }
  return null;
}

/**
 * Текст → картинка (опц. входное фото для контекста).
 * @returns {Promise<{data:string, mimeType:string}>} base64 картинка
 */
export async function generateImage({ prompt, imageBase64, mimeType = 'image/png', model = DEFAULT_MODEL, client } = {}) {
  if (!prompt || !String(prompt).trim()) {
    const e = new Error('Пустой промпт');
    e.code = 'EMPTY_PROMPT';
    throw e;
  }
  const ai = client || getClient();
  const parts = [{ text: String(prompt) }];
  if (imageBase64) parts.push({ inlineData: { mimeType, data: imageBase64 } });

  let resp;
  try {
    resp = await ai.models.generateContent({ model, contents: parts });
  } catch (err) {
    const e = normalizeError(err);
    logError('generateImage', e);
    throw e;
  }
  const img = extractImage(resp);
  if (!img) {
    const e = new Error('Модель не вернула изображение (возможно, сработал фильтр контента).');
    e.code = 'NO_IMAGE';
    logError('generateImage', e);
    throw e;
  }
  return img;
}

/**
 * Редактирование: входное фото обязательно.
 */
export async function editImage({ prompt, imageBase64, mimeType = 'image/png', model = DEFAULT_MODEL, client } = {}) {
  if (!imageBase64) {
    const e = new Error('Для редактирования нужно входное изображение');
    e.code = 'NO_INPUT_IMAGE';
    throw e;
  }
  return generateImage({ prompt, imageBase64, mimeType, model, client });
}

// ---------- история / сохранение ----------
function readHistory() {
  try {
    return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeHistory(list) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(list, null, 2));
}

/**
 * Сохранить картинку на диск + запись в историю. Возвращает запись истории.
 */
export function saveGeneration({ img, prompt, mode = 'generate', model = DEFAULT_MODEL }) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const ext = (img.mimeType.split('/')[1] || 'png').replace('jpeg', 'jpg');
  const filename = `${id}.${ext}`;
  fs.writeFileSync(path.join(IMAGES_DIR, filename), Buffer.from(img.data, 'base64'));

  const entry = {
    id, mode, model, prompt,
    file: filename,
    url: `/images/${filename}`,
    status: 'done',
    createdAt: new Date().toISOString(),
  };
  const list = readHistory();
  list.unshift(entry);
  writeHistory(list.slice(0, 200)); // храним последние 200
  return entry;
}

/**
 * Статус генерации по id (синхронная модель → 'done' или 'not_found').
 */
export function getGenerationStatus(id) {
  const entry = readHistory().find((e) => e.id === id);
  return entry ? { id, status: entry.status, url: entry.url } : { id, status: 'not_found' };
}

export function listHistory(limit = 50) {
  return readHistory().slice(0, limit);
}

export const _paths = { DATA_DIR, IMAGES_DIR, HISTORY_FILE };
