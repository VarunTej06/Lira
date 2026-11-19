import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // The database tests need TEST_DATABASE_URL; without it they are skipped, so the rest still run anywhere.
    testTimeout: 30000,
  },
});
