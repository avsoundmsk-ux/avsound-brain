"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/auth/client";

type Quote = { priceCredits: number; priceUsd: number; costCredits: number; profitCredits: number };
type Job = { id: string; status: string; prompt: string; outputUrl: string | null; priceCredits: number; createdAt: string };

export function DashboardUI({ email, role, balance: initialBalance }: { email: string; role: string; balance: number }) {
  const router = useRouter();
  const isStaff = role === "admin" || role === "owner";

  const [balance, setBalance] = useState(initialBalance);
  const [model, setModel] = useState("seedance-2");
  const [mode, setMode] = useState("text_to_video");
  const [prompt, setPrompt] = useState("");
  const [dur, setDur] = useState(5);
  const [res, setRes] = useState("720p");
  const [q, setQ] = useState<Quote | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);

  const loadJobs = useCallback(async () => {
    const r = await fetch("/api/jobs");
    if (r.ok) setJobs(await r.json());
  }, []);

  const loadBalance = useCallback(async () => {
    const r = await fetch("/api/credits/history");
    if (r.ok) setBalance((await r.json()).balance);
  }, []);

  // авто-расчёт цены при смене параметров
  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await fetch("/api/pricing/quote", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelKey: model, mode, durationSec: dur, resolution: res }),
      });
      const d = await r.json();
      if (alive) r.ok ? setQ(d) : setQ(null);
    })();
    return () => { alive = false; };
  }, [model, mode, dur, res]);

  // первичная загрузка + polling каждые 7с (статусы + баланс)
  const hasActive = useRef(false);
  hasActive.current = jobs.some((j) => j.status === "queued" || j.status === "processing" || j.status === "created");
  useEffect(() => {
    loadJobs();
    const t = setInterval(() => { loadJobs(); if (hasActive.current) loadBalance(); }, 7000);
    return () => clearInterval(t);
  }, [loadJobs, loadBalance]);

  const enough = q ? balance >= q.priceCredits : true;
  const canGen = !!prompt.trim() && !!q && enough && !busy;

  async function generate() {
    setErr(""); setBusy(true);
    try {
      const r = await fetch("/api/jobs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelKey: model, mode, prompt, durationSec: dur, resolution: res }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "ошибка запуска");
      setPrompt("");
      await loadBalance();
      await loadJobs();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Личный кабинет</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {isStaff && <a href="/admin" style={{ ...ghost, textDecoration: "none", lineHeight: "20px" }}>Админка</a>}
          <button onClick={async () => { await signOut(); router.push("/"); }} style={ghost}>Выйти</button>
        </div>
      </div>
      <p style={{ color: "#8b93a3" }}>{email} · роль: <b>{role}</b></p>

      <div style={card}>
        <div style={{ color: "#8b93a3", fontSize: 13 }}>Баланс</div>
        <div style={{ fontSize: 36, fontWeight: 800, color: "#ffd23f" }}>{balance} <span style={{ fontSize: 16 }}>кр</span></div>
        <div style={{ color: "#8b93a3", fontSize: 13 }}>≈ ${(balance * 0.01).toFixed(2)}</div>
        <a href="/dashboard/billing" style={{ ...primary, display: "inline-block", textDecoration: "none", marginTop: 12 }}>Пополнить</a>
      </div>

      {/* ----- Форма генерации ----- */}
      <div style={card}>
        <h3 style={{ marginTop: 0 }}>Генерация видео</h3>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <select value={model} onChange={(e) => setModel(e.target.value)} style={sel}>
            <option value="seedance-2">Seedance 2.0</option>
            <option value="seedance-2-mini">Seedance 2.0 mini (дешевле)</option>
          </select>
          <select value={mode} onChange={(e) => setMode(e.target.value)} style={sel}>
            <option value="text_to_video">text-to-video</option>
            <option value="image_to_video" disabled>image-to-video (скоро)</option>
          </select>
          <select value={res} onChange={(e) => setRes(e.target.value)} style={sel}>
            <option>480p</option><option>720p</option><option>1080p</option>
          </select>
          <label style={{ color: "#8b93a3", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            сек <input type="number" min={4} max={15} value={dur} onChange={(e) => setDur(+e.target.value)} style={{ ...sel, width: 70 }} />
          </label>
        </div>
        <textarea
          placeholder="Опиши ролик: премиум саб Pride в багажнике, неон, медленный наезд…"
          value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3}
          style={{ ...sel, width: "100%", resize: "vertical", marginBottom: 10 }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            {q && <span style={{ fontSize: 18, fontWeight: 700 }}>Цена: {q.priceCredits} кр (${q.priceUsd})</span>}
            {q && !enough && <span style={{ color: "#ff5c5c", marginLeft: 10, fontSize: 13 }}>не хватает баланса</span>}
            {isStaff && q && <div style={{ color: "#8b93a3", fontSize: 12 }}>cost {q.costCredits} · profit {q.profitCredits}</div>}
          </div>
          <button onClick={generate} disabled={!canGen} style={{ ...primary, opacity: canGen ? 1 : 0.5, cursor: canGen ? "pointer" : "default" }}>
            {busy ? "Запуск…" : "Сгенерировать"}
          </button>
        </div>
        {err && <div style={{ color: "#ff5c5c", marginTop: 10 }}>{err}</div>}
      </div>

      {/* ----- История ----- */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>История генераций</h3>
          <button onClick={loadJobs} style={ghost}>Обновить</button>
        </div>
        {jobs.length === 0 && <p style={{ color: "#8b93a3" }}>Пока пусто.</p>}
        {jobs.map((j) => (
          <div key={j.id} style={{ borderTop: "1px solid #2a313d", padding: "10px 0", display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div style={{ overflow: "hidden" }}>
              <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{j.prompt}</div>
              <div style={{ fontSize: 12, color: "#8b93a3" }}>{j.priceCredits} кр · {new Date(j.createdAt).toLocaleString("ru")}</div>
            </div>
            <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
              <span style={{ color: statusColor(j.status), fontWeight: 700 }}>{j.status}</span>
              {j.outputUrl && <div><a href={j.outputUrl} target="_blank" rel="noreferrer" style={{ color: "#ffd23f", fontSize: 12 }}>результат ↗</a></div>}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

function statusColor(s: string): string {
  return s === "completed" ? "#5cd68a" : s === "failed" ? "#ff5c5c" : "#ffd23f";
}

const card: React.CSSProperties = { background: "#161a22", border: "1px solid #2a313d", borderRadius: 14, padding: 20, marginTop: 20 };
const sel: React.CSSProperties = { padding: 10, borderRadius: 8, border: "1px solid #2a313d", background: "#1d222c", color: "#e6e9ef", font: "inherit" };
const primary: React.CSSProperties = { padding: "11px 20px", borderRadius: 8, border: "none", background: "#ffd23f", color: "#1a1a1a", fontWeight: 700 };
const ghost: React.CSSProperties = { padding: "8px 14px", borderRadius: 8, border: "1px solid #2a313d", background: "transparent", color: "#e6e9ef", cursor: "pointer" };
