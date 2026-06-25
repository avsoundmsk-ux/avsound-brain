# AVSound AI-Hub — генерация видео/картинок с авто-выбором провайдера

AI-router: принимает задачу, сам выбирает модель и провайдера по цене/качеству,
оценивает стоимость ДО генерации, при сбое переключается на fallback, сохраняет
результат и историю.

## Провайдеры
| Провайдер | Для чего | Статус |
|---|---|---|
| **modelark** (BytePlus/Bytedance) | Seedance 2.0 напрямую — основной для видео | интерфейс готов, нужен ключ+URL |
| **kie** | универсальный fallback (Seedance, Kling, Veo, Flux, Nano Banana, GPT Image) | **боевой, проверен** |
| **openai** | GPT Image — баннеры, креативы, фон | боевой (нужен ключ) |
| **google** | Gemini/Nano Banana картинки, фон; Veo (видео) — пока через kie | боевой image (нужен ключ) |
| **kling** | видео с людьми, UGC, говорящие персонажи | интерфейс готов, нужен ключ |

Логика: modelark/kling/openai/google — прямые (дешевле/качественнее), **kie — fallback**.
Нет ключа провайдера → он пропускается, берётся следующий (в итоге kie).

## ENV (ключи только тут, в коде не хардкодим)
```
KIE_API_KEY=            # обязателен (fallback работает на нём)
MODELARK_API_KEY=       # опц. прямой Seedance
MODELARK_BASE_URL=https://ark.ap-southeast.bytepluses.com
OPENAI_API_KEY=         # опц. GPT Image
GOOGLE_API_KEY=         # опц. Gemini/Nano Banana
KLING_API_KEY=          # опц. Kling
STORAGE_PATH=./data/output
PUBLIC_BASE_URL=http://localhost:3002
PORT=3002
```

## Установка и запуск
```bash
cd ai-hub
cp .env.example .env     # вписать минимум KIE_API_KEY
npm install
npm run typecheck        # проверка типов
npm test                 # 5 тестов (моки, без сети)
npm start                # сервер на :3002
```

## API
**POST /api/generate**
```json
{
  "type": "video",
  "task": "ugc_video",
  "prompt": "девушка распаковывает сабвуфер Pride",
  "inputImages": ["http://.../ref.jpg"],
  "duration": 6,
  "aspectRatio": "9:16",
  "quality": "balanced",
  "maxPriceUsd": 2
}
```
Ответ:
```json
{
  "success": true,
  "provider": "modelark",
  "model": "seedance-2",
  "estimatedPriceUsd": 0.35,
  "finalPriceUsd": 0.34,
  "outputUrl": "http://localhost:3002/files/....mp4",
  "metadata": { "id": "...", "attempts": [...] }
}
```
**POST /api/estimate** — та же body, вернёт `estimatedPriceUsd` без генерации.
**GET /api/history** — история генераций.

## Типы задач (task)
`product_background`, `product_card`, `banner` (image) ·
`ugc_video`, `car_video`, `social_reel`, `talking_person` (video).
`quality`: `cheap` | `balanced` | `best`.

## Вызов из кода
```ts
import { AiRouter } from "./src/ai/aiRouter.js";
const ai = new AiRouter();
const est = ai.estimate({ type:"video", task:"ugc_video", prompt:"...", duration:5, quality:"cheap" });
const res = await ai.generate({ type:"video", task:"ugc_video", prompt:"...", duration:5, quality:"balanced" });
console.log(res.provider, res.model, res.finalPriceUsd, res.outputUrl);
```

## Тестовые сценарии (npm test)
1. **UGC-видео через Seedance** — выбирается modelark/seedance-2.
2. **Замена фона товара** — image → google/nano-banana-edit.
3. **Fallback** — modelark падает → router уходит на kie.
(+ оценка цены, + валидация пустого промпта.)

## promptEnhancer
Авто-усиление промта под AVSound: для `car_video` добавляет «premium car audio studio,
realistic workshop, cinematic lighting…», для `product_background` — «preserve exact
product shape, do not change logo, clean dark premium background, 1:1…» и т.д.

## Расширение
Новый провайдер: реализуй `Provider` (см. `src/ai/providers/baseProvider.ts`),
добавь в конструктор `AiRouter` и пропиши `providerModelIds` в `modelRegistry.ts`.
Новая модель: добавь `ModelEntry` в реестр. Цены — `pricing.ts`.

## Архитектура
```
src/ai/
  types.ts            типы + ошибки
  modelRegistry.ts    реестр моделей (задача→модель→провайдеры)
  pricing.ts          оценка цены
  promptEnhancer.ts   стиль AVSound по задаче
  aiRouter.ts         выбор/оценка/fallback/сохранение/история
  providers/          kie(боевой), modelark, openai, google, kling
src/api/generate.ts   /api/generate, /api/estimate, /api/history
src/storage/          fileStorage (http/data-url→диск), generationHistory
src/server.ts         express, отдача /files
data/                 output/ + generations.json (gitignore)
```
