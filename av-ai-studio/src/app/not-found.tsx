import Link from "next/link";
export default function NotFound() {
  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: "80px 24px", textAlign: "center", color: "#e6e9ef" }}>
      <h1 style={{ fontSize: 40 }}>404</h1>
      <p style={{ color: "#8b93a3" }}>Страница не найдена.</p>
      <Link href="/" style={{ color: "#ffd23f" }}>На главную</Link>
    </main>
  );
}
