import Link from "next/link";

export default function Home() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
      <h1 style={{ fontSize: 44, marginBottom: 8 }}>🎬 AV Studio</h1>
      <p style={{ color: "#8b93a3", fontSize: 18 }}>
        Единый центр AI-генерации видео и фото. Выбираешь задачу — система берёт нужную модель.
      </p>
      <div style={{ marginTop: 32, display: "flex", gap: 12, justifyContent: "center" }}>
        <Link href="/sign-up" style={btn(true)}>Регистрация</Link>
        <Link href="/sign-in" style={btn(false)}>Вход</Link>
      </div>
    </main>
  );
}

function btn(primary: boolean): React.CSSProperties {
  return {
    padding: "12px 22px", borderRadius: 10, fontWeight: 700, textDecoration: "none",
    background: primary ? "#ffd23f" : "transparent",
    color: primary ? "#1a1a1a" : "#ffd23f",
    border: primary ? "none" : "1px solid #ffd23f",
  };
}
