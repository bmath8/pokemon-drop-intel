import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.pokemon.com",
        pathname: "/static-assets/content-assets/cms2/img/**",
      },
      {
        protocol: "https",
        hostname: "assets.pokemon.com",
        pathname: "/static-assets/content-assets/cms2/img/**",
      },
      {
        protocol: "https",
        hostname: "images.pokemontcg.io",
        pathname: "/**",
      },
    ],
  },
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
