import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the native SQLite driver outside the Next.js bundle. It is provided
  // as a normal Node dependency inside the final Docker image.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
