import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployments
  output: "standalone",

  // Native SQLite binding must run outside the Next bundler
  serverExternalPackages: ["better-sqlite3"],
  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "media.zernio.com",
      },
      {
        protocol: "https",
        hostname: "**.cdninstagram.com",
      },
      {
        protocol: "https",
        hostname: "**.fbcdn.net",
      },
      {
        protocol: "https",
        hostname: "pbs.twimg.com",
      },
    ],
  },
};

export default nextConfig;
