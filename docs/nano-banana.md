# Nano Banana (Gemini Image) — генератор изображений

Интеграция официального Google AI API (`@google/genai`) для генерации и редактирования
изображений. Приложение: `nano-banana-app/`.

## Что умеет
- Текст → картинка.
- Фото + текст → отредактированная/пересобранная картинка.
- Скачивание результата, история генераций (последние 200).
- Современный адаптивный веб-интерфейс `/ai-image-generator`.

## 1. Как получить API-ключ
1. Зайди на https://aistudio.google.com/apikey (Google AI Studio).
2. «Create API key» → скопируй ключ.
3. Ключ даёт доступ к Gemini Developer API (в т.ч. image-моделям).

## 2. Настройка env
```bash
cd nano-banana-app
cp .env.example .env
```
Заполни `.env`:
```
GOOGLE_API_KEY=твой_ключ
NANO_BANANA_MODEL=gemini-2.5-flash-image   # или gemini-3-pro-image-preview
PORT=3001
```
⚠️ `.env` в `.gitignore` — ключ НЕ коммитим.

## 3. Запуск
```bash
cd nano-banana-app
npm install
npm start
# открой http://localhost:3001/ai-image-generator
```
Тесты (без сети, моки):
```bash
npm test
```

## 4. Как пользоваться
1. Вкладка **Генерация** — введи промпт, опц. перетащи фото-референс → «Сгенерировать».
2. Вкладка **Редактирование** — загрузи фото + опиши правку → «Редактировать».
3. Результат справа → «Скачать». Все генерации падают в «Историю».

## 5. Модель и ограничения
- `gemini-2.5-flash-image` — быстрая/дешёвая (Nano Banana), ~1024px.
- `gemini-3-pro-image-preview` — Pro, выше качество/разрешение, дороже.
- Контент-фильтр Google: запросы с запрещённым контентом вернут `NO_IMAGE`.
- Лимиты бесплатного ключа невысокие — при `RATE_LIMIT` подожди/подключи биллинг.
- Размер входного фото ≤ 10 МБ.

## 6. Стоимость
Кратко: `gemini-2.5-flash-image` ≈ **$0.039/картинка**. Полный расчёт — [nano-banana-costs.md](nano-banana-costs.md).

## Архитектура
```
nano-banana-app/
  server.js                       Express: роуты /api/* + отдача страницы
  services/nanobanana/
    index.js                      generateImage / editImage / saveGeneration / getGenerationStatus + лимиты, логи
    nanobanana.test.js            тесты (моки)
  public/                         frontend: index.html, styles.css, app.js
  data/                           images/ + history.json (создаётся в рантайме, в .gitignore)
  .env.example
```
API:
- `POST /api/generate` (form-data: prompt, image?) → запись истории.
- `POST /api/edit` (form-data: prompt, image) → запись истории.
- `GET /api/history`, `GET /api/status/:id`, `GET /api/config`.

## Связанные
- Цены: [nano-banana-costs.md](nano-banana-costs.md)
- Другой путь генерации (KIE, дешевле): навык media-montazher, `tools/kie_gen.py`.
