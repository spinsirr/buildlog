import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  turbopack: {},
  experimental: {
    viewTransition: true,
  },
};

export default nextConfig;
