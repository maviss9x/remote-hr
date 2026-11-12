import type { NextConfig } from "next";
import os from "os";
import path from "path";

function getDevOrigins(): string[] {
  const origins = ["localhost", "127.0.0.1", "192.168.1.196", "192.168.1.2", "*.trycloudflare.com", "*.loca.lt", "*.ngrok-free.app", "*.ngrok-free.dev", "*.ngrok.app", "host.docker.internal"];
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
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

