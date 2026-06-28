"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUp } from "@/auth/client";
import { Shell, inp, primaryBtn } from "@/components/authui";

export default function SignUp() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setBusy(true);
    const { error } = await signUp.email({ name, email, password, callbackURL: "/dashboard" });
    setBusy(false);
    if (error) return setErr(error.message ?? "Ошибка регистрации");
    router.push("/dashboard");
  }

  return (
    <Shell title="Регистрация">
      <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        <input placeholder="Имя" value={name} onChange={(e) => setName(e.target.value)} style={inp} />
        <input placeholder="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={inp} />
        <input placeholder="Пароль (мин 8)" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} style={inp} />
        {err && <div style={{ color: "#ff5c5c", fontSize: 13 }}>{err}</div>}
        <button disabled={busy} style={primaryBtn}>{busy ? "..." : "Создать аккаунт"}</button>
      </form>
      <p style={{ color: "#8b93a3", marginTop: 16 }}>Уже есть аккаунт? <Link href="/sign-in" style={{ color: "#ffd23f" }}>Войти</Link></p>
    </Shell>
  );
}

