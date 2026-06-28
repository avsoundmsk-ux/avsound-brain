// Общие UI-куски для auth-страниц (не page-файл → можно именованные экспорты).
import type { ReactNode } from "react";

export function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main style={{ maxWidth: 380, margin: "0 auto", padding: "72px 24px" }}>
      <h1 style={{ marginBottom: 24 }}>{title}</h1>
      {children}
    </main>
  );
}

export const inp: React.CSSProperties = { padding: 12, borderRadius: 10, border: "1px solid #2a313d", background: "#161a22", color: "#e6e9ef", font: "inherit" };
export const primaryBtn: React.CSSProperties = { padding: 13, borderRadius: 10, border: "none", background: "#ffd23f", color: "#1a1a1a", fontWeight: 700, cursor: "pointer" };
