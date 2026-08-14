import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // PGlite instances are heavy; a generous timeout beats flaky CI.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: 'forks',
  },
});
