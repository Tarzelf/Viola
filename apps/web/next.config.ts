import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // sharp, @resvg/resvg-js and PGlite are native/wasm and must not be bundled.
  serverExternalPackages: [
    'sharp',
    '@resvg/resvg-js',
    '@electric-sql/pglite',
    'satori',
    'postgres',
  ],
  typedRoutes: false,
  experimental: {
    // The whole monorepo is TypeScript source; let Next transpile it directly
    // rather than requiring a build step per package during dev.
  },
  transpilePackages: [
    '@viola/core',
    '@viola/design',
    '@viola/db',
    '@viola/pipeline',
    '@viola/render',
  ],
};

export default config;
