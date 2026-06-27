import type { NextConfig } from "next";

// SECURITY (L-4): базовые security headers на все ответы.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // server-only пакеты не бандлим в клиент
  serverExternalPackages: ["postgres", "argon2", "better-auth"],
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  // резолв TS-импортов вида "./x.js" → x.ts (NodeNext-стиль в webpack)
  webpack(config) {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
