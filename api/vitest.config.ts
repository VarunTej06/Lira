import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // The database tests need TEST_DATABASE_URL; without it they are skipped, so the rest still run anywhere.
    // One file at a time: they share the server and create the same database role.
    fileParallelism: false,
    testTimeout: 30000,
  },
});
