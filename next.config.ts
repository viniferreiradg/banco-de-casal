import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Treat native/heavy packages as external so Next.js doesn't bundle them
  serverExternalPackages: ["@anthropic-ai/sdk"],
};

export default nextConfig;
