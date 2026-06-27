/**
 * Маршрут better-auth: /api/auth/* (signup, signin, verify, reset, 2fa и т.д.).
 * better-auth сам обрабатывает все суб-пути.
 */
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/auth/auth";

export const { GET, POST } = toNextJsHandler(auth);
