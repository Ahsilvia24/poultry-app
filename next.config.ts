import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow local / cloud-agent tunnel hosts in development
  allowedDevOrigins: ["127.0.0.1", "localhost", "*.loca.lt", "*.trycloudflare.com"],
};

export default nextConfig;
