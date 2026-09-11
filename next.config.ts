import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse ships pdf.js workers — do not bundle them into server actions.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
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
    "*.agent.cvm.dev",
    "*.cursorapi.com",
    "*.cursor.sh",
  ],
  outputFileTracingExcludes: {
    "/*": ["./mobile/**/*"],
  },
  experimental: {
    // Homescreen PWA tab switches were refetching every dynamic page (Next 15+
    // default dynamic staleTime is 0). Keep a short client cache so Dashboard /
    // Farms / LFO / Reports / Tools feel instant when flipping between them.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
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
