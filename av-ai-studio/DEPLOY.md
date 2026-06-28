# Деплой AV AI Studio

Архитектура прод:
- **Next (web+API)** → Vercel
- **Postgres + pg-boss очередь** → Neon (уже есть)
- **Воркер генераций** → Hetzner (Docker или systemd)
- **БД одна** для web и воркера (общий pg-boss).

---

## 0. Репозиторий
Vercel деплоит из Git. Код в `av-ai-studio/` внутри основного репо.
- Вариант A (просто): импортировать весь репо в Vercel, **Root Directory = `av-ai-studio`**.
- Вариант B: вынести `av-ai-studio` в отдельный GitHub-репо.
⚠️ `.env` НЕ коммитить (уже в .gitignore). Все ключи — в секретах Vercel/Hetzner.

---

## 1. Разделение ENV

### Vercel (web + API) — нужны:
```
DATABASE_URL              # Neon (pooled connection)
BETTER_AUTH_SECRET        # ≥32 симв
BETTER_AUTH_URL           # https://боевой-домен
NODE_ENV=production
OWNER_EMAIL=avsoundmsk@gmail.com
# опц. для пополнений/фич (позже): SMTP_*, YOOKASSA_*, STRIPE_*
# S3_* — нужны и web, и воркеру (web может отдавать ссылки)
```
Web НЕ нужен MODELARK/KIE (генерация — в воркере), но безвредно если есть.

### Worker (Hetzner) — нужны:
```
DATABASE_URL              # тот же Neon
MODELARK_API_KEY
MODELARK_BASE_URL=https://ark.ap-southeast.bytepluses.com
KIE_API_KEY               # fallback
S3_ENDPOINT / S3_BUCKET / S3_ACCESS_KEY / S3_SECRET_KEY / S3_PUBLIC_BASE   # когда подключим R2
NODE_ENV=production
```

---

## 2. Vercel (web)
1. vercel.com → Add New → Project → импорт репо.
2. **Root Directory = av-ai-studio**. Framework: Next.js (auto).
3. Settings → Environment Variables → вставить блок «Vercel» выше (Production).
4. Deploy. Получишь `https://<project>.vercel.app`.
5. `BETTER_AUTH_URL` = этот URL (или кастомный домен из шага 6) → redeploy.

## 3. Миграции + seed (один раз, локально против прод-БД)
```bash
# .env с прод DATABASE_URL
npx drizzle-kit push
npx tsx src/db/seed.ts
# сделать себя owner:
#   update "user" set role='owner' where email='avsoundmsk@gmail.com';
```

## 4. Worker на Hetzner

### Docker
```bash
scp -r av-ai-studio user@178.105.105.46:/opt/av-ai-studio   # или git clone
cd /opt/av-ai-studio
# создать .env.worker с блоком "Worker"
docker build -f Dockerfile.worker -t av-ai-worker .
docker run -d --restart=always --env-file .env.worker --name av-ai-worker av-ai-worker
docker logs -f av-ai-worker   # должно быть "[worker] running, queue: generate"
```

### systemd (без Docker)
```bash
# код в /opt/av-ai-studio, npm ci, npm i tsx
cp deploy/av-ai-worker.service /etc/systemd/system/
# заполнить /opt/av-ai-studio/.env.worker
systemctl daemon-reload && systemctl enable --now av-ai-worker
journalctl -u av-ai-worker -f
```

## 5. Домен / поддомен
- Рекомендую поддомен: `studio.av-sound.ru` (или `ai.av-sound.ru`).
- В DNS av-sound.ru: CNAME `studio` → `cname.vercel-dns.com` (Vercel покажет точное значение).
- Vercel → Project → Domains → Add `studio.av-sound.ru` → подтвердить.
- Обновить `BETTER_AUTH_URL=https://studio.av-sound.ru` → redeploy.

## 6. Пост-деплой проверки
```bash
curl https://studio.av-sound.ru/api/health        # {"ok":true,"db":"up"}
curl -X POST https://studio.av-sound.ru/api/topups/confirm -d '{}'   # ждём 403 (dev-confirm off)
```
- Регистрация → вход → кабинет.
- Owner начисляет себе кредиты в админке (adjust) — dev-confirm в проде выключен.
- Создать генерацию → воркер на Hetzner подхватит → completed + ссылка.
- Liveflow против прод-БД: `DATABASE_URL=<prod> npx tsx scripts/liveflow.ts`.

## 7. Готовность (gate)
- [ ] `npm run check` зелёный (typecheck + 20 тестов)
- [ ] `npm run build` ок
- [ ] /api/health = 200
- [ ] dev-confirm = 403 в проде
- [ ] воркер запущен и видит очередь
- [ ] owner + 2FA
- [ ] Neon backup (PITR/branch) включён

Платежи (ЮKassa/Stripe), R2, Resend — подключаем после успешного базового деплоя.
