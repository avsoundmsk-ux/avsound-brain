# AV AI Studio — трекер фаз

Архитектура: [docs/superpowers/specs/2026-06-27-av-ai-studio-architecture.md](../docs/superpowers/specs/2026-06-27-av-ai-studio-architecture.md)
Стек: Next.js 15 · Postgres/Drizzle · better-auth · pg-boss · ЮKassa+Stripe · ai-hub · Vercel+worker(Hetzner).

## P0 — AI-ядро ✅
`ai-hub/` готов: provider-абстракция, ModelArk Seedance 2.0 (`dreamina-seedance-2-0-260128`) работает, KIE fallback, pricing.

## P1 — Фундамент 🔧 (в работе)
- [x] package.json, .env.example
- [x] Полная схема БД (`src/db/schema.ts`): users/sessions/verification, providers/models/price_rules, credit_ledger, topups, jobs/job_logs, prompt_library/folders/favorites/promo_codes, admin_audit
- [x] db client (`src/db/index.ts`), drizzle.config
- [ ] better-auth (email verify, reset, роли, 2FA) — `src/auth/`
- [ ] middleware: rate-limit, CSRF, роли
- [ ] миграция в Postgres (нужен DATABASE_URL)

## P2 — Кредиты + цены
- [ ] PricingService: computePrice(cost, rule) fixed|markup|multiplier
- [ ] CreditService: balance (sum ledger), hold/settle/refund атомарно (транзакция)
- [ ] калькулятор стоимости (API) — цена ДО запуска

## P3 — Генерация + очередь
- [ ] JobService: создать job → hold → enqueue
- [ ] pg-boss worker: ai-hub.generate → settle/refund, retry/timeout, логи
- [ ] S3 загрузка результата, история, повтор

## P4 — Платежи
- [ ] ЮKassa + Stripe: создание платежа, webhook + проверка подписи → topup→ledger

## P5 — Админка
- [ ] пользователи/балансы/пополнения/списания/jobs(restart)/модели/цены/прибыль/refund/блок/audit, 2FA

## P6 — Продукт-UX
- [ ] библиотека промтов, шаблоны, повтор, копировать, папки/избранное, промокоды

## P7 — Харднинг
- [ ] anti-brute-force, бэкапы, мониторинг, режимы i2v/v2v/image/audio

## Нужно от владельца (инфра)
DATABASE_URL (Neon), SMTP, ЮKassa shopId+secret, Stripe secret+webhook, S3 ключи. Провайдеры (KIE/ModelArk) — уже есть.
