/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      os: false,
      path: false,
      crypto: false,
    };
    // pino-pretty is an optional runtime dependency of pino (used by Solana web3.js)
    // It's not needed in the browser bundle
    config.externals = [...(config.externals || []), "pino-pretty"];
    return config;
  },
};

module.exports = nextConfig;
