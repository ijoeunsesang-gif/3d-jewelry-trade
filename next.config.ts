import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    loader: "custom",
    loaderFile: "./lib/imageLoader.ts",
    minimumCacheTTL: 60,
    remotePatterns: [
      { protocol: "https", hostname: "images.3d-jewelry-trade.com" },
      { protocol: "https", hostname: "**.r2.dev" },
      { protocol: "https", hostname: "**.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "fvhotaxjdacfulxjahon.supabase.co" },
    ],
  },
};

export default nextConfig;
