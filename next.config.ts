import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow cloud agent tunnels / forwarded hosts in dev
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "*.loca.lt",
    "happy-windows-cough.loca.lt",
  ],
};

export default nextConfig;
