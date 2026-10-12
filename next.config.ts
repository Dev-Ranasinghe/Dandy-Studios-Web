import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Shared build hosts (Hostinger) report the whole machine's cores but give the container a
    // sliver of them; one worker per reported core starved the build. The site is 4 static pages.
    cpus: 1,
  },
};

export default nextConfig;
