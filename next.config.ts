import type { NextConfig } from "next";
import os from "os";
import path from "path";

function getDevOrigins(): string[] {
  const origins = ["localhost", "127.0.0.1", "192.168.1.196", "192.168.1.2", "*.trycloudflare.com", "host.docker.internal"];
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === "IPv4" && !iface.internal) {
          origins.push(iface.address);
        }
      }
    }
  } catch {
    // fallback
  }
  return Array.from(new Set(origins));
}


const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  allowedDevOrigins: getDevOrigins(),
};

export default nextConfig;

