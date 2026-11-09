import { defineConfig } from 'vitest/config'

/** The data health check: reads your real data folder. Run with `npm run test:health`. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/health/**/*.test.ts'],
  },
})
