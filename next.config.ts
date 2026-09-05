import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bottom tabs sit at the left; keep the Next.js N badge off that control.
  devIndicators: {
    position: "top-right",
  },
  // Allow local / cloud-agent tunnel hosts in development (Server Actions + HMR)
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "*.loca.lt",
    "*.trycloudflare.com",
    "*.onrender.com",
    "*.agent.cvm.dev",
    "*.cursorapi.com",
    "*.cursor.sh",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
      allowedOrigins: [
        "*.trycloudflare.com",
        "*.onrender.com",
        "*.loca.lt",
        "*.agent.cvm.dev",
        "*.cursorapi.com",
        "*.cursor.sh",
      ],
    },
  },
};

export default nextConfig;
