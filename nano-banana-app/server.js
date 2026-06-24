/**
 * Express-сервер Nano Banana генератора.
 * Роуты:
 *   GET  /ai-image-generator   — страница генератора
 *   POST /api/generate         — текст (+опц. фото) → картинка
 *   POST /api/edit             — фото + текст → картинка
 *   GET  /api/history          — история генераций
 *   GET  /api/status/:id       — статус по id
 *   GET  /images/*             — отдача сохранённых картинок
 */
import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  generateImage, editImage, saveGeneration,
  getGenerationStatus, listHistory, DEFAULT_MODEL, _paths,
} from './services/nanobanana/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10 MB

app.use(express.json({ limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(_paths.IMAGES_DIR));

app.get('/ai-image-generator', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/', (_req, res) => res.redirect('/ai-image-generator'));

function fileToBase64(file) {
  if (!file) return null;
  return { imageBase64: file.buffer.toString('base64'), mimeType: file.mimetype || 'image/png' };
}

function handleError(res, err) {
  const map = { EMPTY_PROMPT: 400, NO_INPUT_IMAGE: 400, NO_API_KEY: 500, AUTH: 401, RATE_LIMIT: 429, NO_IMAGE: 422 };
  res.status(map[err.code] || 500).json({ error: err.message, code: err.code || 'API_ERROR' });
}

app.post('/api/generate', upload.single('image'), async (req, res) => {
  try {
    const prompt = req.body?.prompt;
    const inp = fileToBase64(req.file);
    const img = await generateImage({ prompt, ...(inp || {}) });
    const entry = saveGeneration({ img, prompt, mode: inp ? 'generate+ref' : 'generate', model: DEFAULT_MODEL });
    res.json(entry);
  } catch (err) { handleError(res, err); }
});

app.post('/api/edit', upload.single('image'), async (req, res) => {
  try {
    const prompt = req.body?.prompt;
    const inp = fileToBase64(req.file);
    const img = await editImage({ prompt, ...(inp || {}) });
    const entry = saveGeneration({ img, prompt, mode: 'edit', model: DEFAULT_MODEL });
    res.json(entry);
  } catch (err) { handleError(res, err); }
});

app.get('/api/history', (_req, res) => res.json(listHistory(50)));
app.get('/api/status/:id', (req, res) => res.json(getGenerationStatus(req.params.id)));
app.get('/api/config', (_req, res) => res.json({ model: DEFAULT_MODEL, hasKey: !!process.env.GOOGLE_API_KEY }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Nano Banana генератор: http://localhost:${PORT}/ai-image-generator`);
  console.log(`Модель: ${DEFAULT_MODEL} | ключ задан: ${!!process.env.GOOGLE_API_KEY}`);
});

export { app };
