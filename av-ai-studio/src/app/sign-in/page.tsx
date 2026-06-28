"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/auth/client";
import { Shell, inp, primaryBtn } from "@/components/authui";

export default function SignIn() {
  const router = useRouter();
  const redirect = useSearchParams().get("redirect") || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setBusy(true);
    const { error } = await signIn.email({ email, password });
    setBusy(false);
    if (error) return setErr(error.message ?? "Неверный email или пароль");
    router.push(redirect);
  }

  return (
    <Shell title="Вход">
      <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        <input placeholder="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={inp} />
        <input placeholder="Пароль" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} style={inp} />
        {err && <div style={{ color: "#ff5c5c", fontSize: 13 }}>{err}</div>}
        <button disabled={busy} style={primaryBtn}>{busy ? "..." : "Войти"}</button>
      </form>
      <p style={{ color: "#8b93a3", marginTop: 16 }}>Нет аккаунта? <Link href="/sign-up" style={{ color: "#ffd23f" }}>Регистрация</Link></p>
    </Shell>
  );
}
