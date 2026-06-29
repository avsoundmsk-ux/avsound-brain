/**
 * better-auth — ядро аутентификации AV Studio.
 * Спека: email/password (argon2), email verify, password reset, роли (additionalFields),
 * 2FA TOTP (plugin). Вся критичная логика — server-only.
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor } from "better-auth/plugins/two-factor";
import argon2 from "argon2";
import { BETTER_AUTH_SECRET, BETTER_AUTH_URL } from "@/env";
import { db } from "@/db";
import { sendEmail } from "@/auth/email";
import {
  user, session, account, verification, twoFactor as twoFactorTable,
} from "@/db/schema";

export const auth = betterAuth({
  appName: "AV Studio",
  secret: BETTER_AUTH_SECRET,
  baseURL: BETTER_AUTH_URL,
  trustedOrigins: [BETTER_AUTH_URL],

  // rate-limit чувствительных auth-эндпоинтов (storage memory — без БД)
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
      "/forget-password": { window: 60, max: 3 },
      "/two-factor/verify": { window: 60, max: 5 },
    },
  },

  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification, twoFactor: twoFactorTable },
  }),

  emailAndPassword: {
    enabled: true,
    // prod — строго (нужен verify); dev без SMTP — разрешаем вход для локального теста
    requireEmailVerification: process.env.NODE_ENV === "production",
    autoSignIn: false,
    // argon2 вместо дефолтного scrypt (по спеке безопасности)
    password: {
      hash: (password) => argon2.hash(password),
      verify: ({ hash, password }) => argon2.verify(hash, password),
    },
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Сброс пароля — AV Studio",
        text: `Для сброса пароля перейдите по ссылке: ${url}`,
      });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Подтверждение email — AV Studio",
        text: `Подтвердите email по ссылке: ${url}`,
      });
    },
  },

  // роли: user | admin | owner — задаются backend, не вводом пользователя
  user: {
    additionalFields: {
      role: { type: "string", required: false, defaultValue: "user", input: false },
      status: { type: "string", required: false, defaultValue: "active", input: false },
    },
  },

  plugins: [twoFactor()],
});

export type Session = typeof auth.$Infer.Session;
