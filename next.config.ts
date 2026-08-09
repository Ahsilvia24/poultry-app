import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow local / cloud-agent tunnel hosts in development (Server Actions + HMR)
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "*.loca.lt",
    "*.trycloudflare.com",
    "*.agent.cvm.dev",
    "*.cursorapi.com",
    "*.cursor.sh",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
      allowedOrigins: [
        "*.trycloudflare.com",
        "*.loca.lt",
        "*.agent.cvm.dev",
        "*.cursorapi.com",
        "*.cursor.sh",
      ],
    },
  },
};

export default nextConfig;
