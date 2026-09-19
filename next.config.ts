import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // unpdf ships an inlined pdf.js worker. Copy only that package onto
  // serverless functions. pdf-parse / pdfjs-dist are 50MB+ fallbacks and
  // blew up Vercel production deploys when attached to every route.
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-pg",
    "pg",
    "prisma",
    "unpdf",
    "pdf-parse",
    "pdfjs-dist",
  ],
  outputFileTracingIncludes: {
    "/api/leave": ["./public/signed-out.html"],
    "/*": ["./node_modules/unpdf/dist/**/*"],
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
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
    "/*": [
      "./mobile/**/*",
      "./node_modules/pdf-parse/**/*",
      "./node_modules/pdfjs-dist/**/*",
      "./node_modules/.prisma/client/libquery_engine-debian-*",
      "./node_modules/.prisma/client/query_engine-windows-*",
      "./node_modules/.prisma/client/libquery_engine-*darwin*",
      "./node_modules/.prisma/client/query_engine_bg.wasm",
      "./node_modules/@prisma/engines/**/*",
    ],
  },
  experimental: {
    // Homescreen PWA tab switches were refetching every dynamic page (Next 15+
    // default dynamic staleTime is 0). Keep a longer client cache so Dashboard /
    // Farms / LFO / Reports / Tools stay usable on spotty phone service.
    staleTimes: {
      dynamic: 180,
      static: 600,
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
