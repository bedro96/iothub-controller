import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable the standalone server as we're using a custom server
  output: undefined,
};

export default nextConfig;
