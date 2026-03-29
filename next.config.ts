import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };
    /* Cornerstone3D wasm file loading */
    config.module.rules.push({
      test: /\.wasm$/,
      type: "asset/resource",
    });

    /* Stub out Node.js built-ins that Cornerstone3D codec decoders reference */
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
      stream: false,
      os: false,
      http: false,
      https: false,
      zlib: false,
    };

    return config;
  },
};

export default nextConfig;
