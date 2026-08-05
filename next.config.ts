import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow local / cloud-agent tunnel hosts in development (Server Actions + HMR)
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "*.loca.lt",
    "*.trycloudflare.com",
  ],
  // Hide the Next.js dev indicator from App Store screenshot captures
  devIndicators: false,
};

export default nextConfig;
