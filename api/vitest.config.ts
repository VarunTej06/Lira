import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // The database tests need TEST_DATABASE_URL; without it they are skipped, so the rest still run anywhere.
    // One file at a time: they share the server and create the same database role.
    fileParallelism: false,
    testTimeout: 120000, // a test that makes many requests in a row takes long against a database in the cloud
    // Making a test schema and applying every migration takes a while against a database in the cloud
    hookTimeout: 180000,
  },
});
