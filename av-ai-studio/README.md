# AV Studio

Веб-платформа AI-генерации (видео/фото) с балансом кредитов, ценами, очередью генераций,
хранилищем результатов и админкой. Стек: **Next.js 15 (App Router) · Postgres/Drizzle ·
better-auth · pg-boss · ModelArk(Seedance)+KIE · R2/S3**.

## Возможности
- Регистрация/вход (email+пароль, argon2), роли user/admin/owner, 2FA для staff.
- Баланс кредитов (immutable ledger), цены (fixed/markup/multiplier), калькулятор до запуска.
- Генерация через очередь: hold → ModelArk Seedance 2.0 → settle/refund, история, логи.
- Хранилище результата в R2/S3 (fallback на provider-url, если R2 не настроен).
- Пополнение баланса (dev-confirm; место под webhook ЮKassa/Stripe).
- Админка: пользователи, балансы, генерации (restart/refund), цены, прибыль, audit.

## Структура
```
src/
  app/            страницы + API (App Router)
    api/          auth, me, jobs, pricing, credits, topups, admin, health
    dashboard/    кабинет + billing
    admin/        админка
  auth/           better-auth (auth, client, guards, routes, email)
  db/             schema (Drizzle), client, seed
  services/       credits, pricing, jobs, topups, packages, admin, providerCost
  generation/     generator (ModelArk)
  storage/        R2/S3 abstraction (persistResult)
  queue/          pg-boss
  worker/         воркер генераций
  server/         csrf, rate-limit
test/             интеграц. тесты (services, jobs, storage, admin, topups)
scripts/          liveflow (E2E)
```

## Запуск локально
```bash
cd av-studio
cp .env.example .env          # заполнить (минимум DATABASE_URL, BETTER_AUTH_SECRET)
npm install
npm run db:generate && npx drizzle-kit push   # схема в БД
npx tsx src/db/seed.ts        # провайдеры, модель seedance-2, цены
# терминал 1:
npm run dev                   # http://localhost:3000
# терминал 2 (генерации):
npm run worker
```
Сделать себя owner: в БД `update "user" set role='owner' where email='ТВОЙ';`
Начислить кредиты в dev: кабинет → Пополнить → купить пакет → «подтвердить оплату».

## Скрипты
- `npm run dev` / `build` / `start` — Next
- `npm run worker` — воркер очереди
- `npm run check` — **typecheck + все тесты** (CI-гейт)
- `npm run liveflow` — E2E прогон (реальная генерация ModelArk)
- `npm run db:generate` / `db:studio` — Drizzle

## ENV
См. `.env.example`. Критичные: `DATABASE_URL`, `BETTER_AUTH_SECRET` (≥32 симв), `BETTER_AUTH_URL`.
Опциональные (fallback если нет): `MODELARK_API_KEY`/`MODELARK_BASE_URL`, `KIE_API_KEY`,
`S3_*` (R2), `SMTP_*` (письма), `YOOKASSA_*`/`STRIPE_*` (платежи).

## Healthcheck
`GET /api/health` → `{ ok, db }` (200/503). Для аптайм-мониторинга и readiness.

## Production checklist
- [ ] `BETTER_AUTH_SECRET` ≥32 симв, уникальный; `BETTER_AUTH_URL` = боевой https-домен.
- [ ] `NODE_ENV=production` (включает email-verify, выключает dev-confirm пополнений).
- [ ] SMTP настроен (verify/reset реально отправляются).
- [ ] Платёжный webhook вместо dev-confirm (проверка подписи) до приёма денег.
- [ ] R2/S3 заполнены (стабильные ссылки на результаты).
- [ ] Миграции применены (`drizzle-kit push`/`migrate`), seed выполнен.
- [ ] Воркер запущен и подключён к той же БД (pg-boss).
- [ ] `.env` НЕ в git (см. `.gitignore`). Ключи — только в секретах хостинга.
- [ ] `npm run check` зелёный.
- [ ] owner-аккаунт создан, 2FA включена для admin/owner.
- [ ] Бэкап БД (Neon PITR/branch) включён.

## Деплой
**Frontend + API → Vercel:**
- Импортировать репозиторий (root = `av-studio`), framework Next.js.
- Env-переменные из `.env.example` → в Vercel Project Settings.
- `serverExternalPackages` (postgres/argon2/better-auth) уже в `next.config.ts`.

**Воркер → отдельный процесс (Vercel не держит долгие процессы):**
- На VPS (Hetzner) или Railway/Render: `npm ci && npm run worker`.
- Тот же `DATABASE_URL` (общий Postgres/pg-boss). Держать через `pm2`/systemd, автозапуск.
- ModelArk генерация идёт в воркере → ему нужны `MODELARK_*`, `S3_*`, `DATABASE_URL`.

**БД → Neon** (serverless Postgres). Включить branching/PITR для бэкапов.
**Хранилище → Cloudflare R2** (S3-совместимое), публичный домен в `S3_PUBLIC_BASE`.

## Безопасность
Вся логика баланса/цены/списания/возврата/ключей — backend. Фронт ничего критичного не решает.
CSRF (origin-check) на мутациях, rate-limit на чувствительных роутах, роли в guards,
audit-лог админ-действий, секреты только в env.
