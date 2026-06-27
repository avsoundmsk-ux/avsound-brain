"use client";
// Клиент better-auth для React (browser). baseURL = текущий origin.
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();
export const { signIn, signUp, signOut, useSession } = authClient;
