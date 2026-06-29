import type { ReactNode } from "react";

export const metadata = {
  title: "AV Studio",
  description: "Единый центр AI-генерации",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body style={{
        margin: 0,
        fontFamily: "-apple-system, Segoe UI, Roboto, sans-serif",
        background: "#0d0f14", color: "#e6e9ef",
      }}>
        {children}
      </body>
    </html>
  );
}
