import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the LAN IP to load dev resources (silences the cross-origin HMR
  // warning when the dev server is reached over the network). Dev-only.
  allowedDevOrigins: ["127.0.0.1", "172.28.32.1"],
};

export default nextConfig;
