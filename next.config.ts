import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Treat pdf-parse as an external package so Next.js doesn't bundle it
  // (avoids DOMMatrix / canvas issues during build-time static analysis)
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
