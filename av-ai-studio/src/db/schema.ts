/**
 * Полная схема БД AV AI Studio (Drizzle / Postgres).
 * Принцип: вся критичная логика (баланс, цены, ключи) — backend.
 * Баланс = сумма immutable-записей credit_ledger (не редактируется напрямую).
 */
import {
  pgTable, text, uuid, integer, bigint, boolean, timestamp, jsonb, pgEnum, index,
} from "drizzle-orm/pg-core";

// ---------- enums ----------
export const roleEnum = pgEnum("role", ["user", "admin", "owner"]);
export const userStatusEnum = pgEnum("user_status", ["active", "blocked"]);
export const ledgerTypeEnum = pgEnum("ledger_type", ["topup", "hold", "settle", "refund", "adjust", "bonus"]);
export const jobStatusEnum = pgEnum("job_status", ["created", "queued", "processing", "completed", "failed", "refunded"]);
export const modeEnum = pgEnum("mode", [
  "text_to_video", "image_to_video", "video_to_video",
  "image_generation", "image_editing", "audio", "voice", "document", "workflow",
]);
export const priceTypeEnum = pgEnum("price_type", ["fixed", "markup", "multiplier"]);
export const topupStatusEnum = pgEnum("topup_status", ["pending", "paid", "failed", "canceled"]);
export const payProviderEnum = pgEnum("pay_provider", ["yookassa", "stripe", "manual"]);

// ---------- users / auth ----------
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),         // argon2; null если соц-вход
  name: text("name"),
  role: roleEnum("role").notNull().default("user"),
  status: userStatusEnum("status").notNull().default("active"),
  emailVerified: boolean("email_verified").notNull().default(false),
  twoFactorSecret: text("two_factor_secret"),  // TOTP для admin/owner
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ emailIdx: index("users_email_idx").on(t.email) }));

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// токены для verify email / reset password
export const verificationTokens = pgTable("verification_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  purpose: text("purpose").notNull(),          // "email_verify" | "password_reset"
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
});

// ---------- провайдеры / модели / режимы / цены ----------
export const providers = pgTable("providers", {
  id: text("id").primaryKey(),                  // "modelark" | "kie" | ...
  title: text("title").notNull(),
  enabled: boolean("enabled").notNull().default(true),
});

export const models = pgTable("models", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull().unique(),         // логич. id ("seedance-2")
  title: text("title").notNull(),
  providerId: text("provider_id").notNull().references(() => providers.id),
  providerModelId: text("provider_model_id").notNull(), // "dreamina-seedance-2-0-260128"
  enabled: boolean("enabled").notNull().default(true),
  meta: jsonb("meta"),                          // разрешения, лимиты и пр.
});

// цена за (модель, режим) — задаёт админ
export const priceRules = pgTable("price_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  modelId: uuid("model_id").notNull().references(() => models.id, { onDelete: "cascade" }),
  mode: modeEnum("mode").notNull(),
  priceType: priceTypeEnum("price_type").notNull(),  // fixed|markup|multiplier
  value: integer("value").notNull(),                 // fixed=кредиты; markup=+кредиты; multiplier=%×100 (200=×2)
  enabled: boolean("enabled").notNull().default(true),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({ modelModeIdx: index("price_rules_model_mode_idx").on(t.modelId, t.mode) }));

// ---------- кредиты (immutable ledger) ----------
export const creditLedger = pgTable("credit_ledger", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: ledgerTypeEnum("type").notNull(),
  delta: integer("delta").notNull(),           // + начисление, − списание (в кредитах)
  balanceAfter: integer("balance_after").notNull(),
  jobId: uuid("job_id"),                        // связь с генерацией (hold/settle/refund)
  topupId: uuid("topup_id"),
  note: text("note"),
  createdBy: uuid("created_by").references(() => users.id), // админ для adjust
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ userIdx: index("ledger_user_idx").on(t.userId, t.createdAt) }));

// ---------- пополнения ----------
export const topups = pgTable("topups", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  payProvider: payProviderEnum("pay_provider").notNull(),
  amountMinor: bigint("amount_minor", { mode: "number" }).notNull(), // в копейках/центах
  currency: text("currency").notNull().default("RUB"),
  credits: integer("credits").notNull(),       // сколько кредитов начислить
  status: topupStatusEnum("status").notNull().default("pending"),
  externalId: text("external_id"),             // id платежа у провайдера
  webhookVerified: boolean("webhook_verified").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  paidAt: timestamp("paid_at"),
});

// ---------- jobs (генерации) ----------
export const jobs = pgTable("jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  modelId: uuid("model_id").notNull().references(() => models.id),
  mode: modeEnum("mode").notNull(),
  status: jobStatusEnum("status").notNull().default("created"),
  prompt: text("prompt").notNull(),
  params: jsonb("params"),                      // duration, resolution, inputImages...
  // экономика (в кредитах)
  costCredits: integer("cost_credits"),         // себестоимость (по факту провайдера)
  priceCredits: integer("price_credits").notNull(), // цена клиенту (списано)
  profitCredits: integer("profit_credits"),     // price − cost
  // результат
  providerTaskId: text("provider_task_id"),
  outputUrl: text("output_url"),
  error: text("error"),
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
}, (t) => ({ userIdx: index("jobs_user_idx").on(t.userId, t.createdAt), statusIdx: index("jobs_status_idx").on(t.status) }));

export const jobLogs = pgTable("job_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  level: text("level").notNull().default("info"),
  message: text("message").notNull(),
  data: jsonb("data"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ---------- продукт: промты, шаблоны, папки ----------
export const promptLibrary = pgTable("prompt_library", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }), // null = общий
  title: text("title").notNull(),
  prompt: text("prompt").notNull(),
  tags: jsonb("tags"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const folders = pgTable("folders", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
});

export const favorites = pgTable("favorites", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  folderId: uuid("folder_id").references(() => folders.id, { onDelete: "set null" }),
});

export const promoCodes = pgTable("promo_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  credits: integer("credits").notNull(),
  maxUses: integer("max_uses").notNull().default(1),
  uses: integer("uses").notNull().default(0),
  expiresAt: timestamp("expires_at"),
  enabled: boolean("enabled").notNull().default(true),
});

// ---------- админ-аудит ----------
export const adminAudit = pgTable("admin_audit", {
  id: uuid("id").defaultRandom().primaryKey(),
  adminId: uuid("admin_id").notNull().references(() => users.id),
  action: text("action").notNull(),            // "refund", "block_user", "set_price"...
  targetType: text("target_type"),
  targetId: text("target_id"),
  data: jsonb("data"),
  ip: text("ip"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
