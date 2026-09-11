import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // unpdf ships an inlined pdf.js worker. Keep it (and the older
  // pdf-parse / pdf.js fallbacks) on disk for Vercel serverless.
  serverExternalPackages: ["unpdf", "pdf-parse", "pdfjs-dist"],
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/unpdf/dist/**/*",
      "./node_modules/pdf-parse/dist/**/*",
      "./node_modules/pdfjs-dist/legacy/build/**/*",
      "./node_modules/pdfjs-dist/build/**/*",
    ],
  },
  async headers() {
    return [
      {
        source: "/login",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
      {
        source: "/register",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
    ];
  },
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
