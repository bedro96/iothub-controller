import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable the standalone server as we're using a custom server
  output: undefined,
  
  experimental: {
    // Ensure external packages are not bundled by Next.js
    // This helps prevent AsyncLocalStorage conflicts
    serverExternalPackages: ['ws', 'socket.io'],
  },
};

export default nextConfig;
