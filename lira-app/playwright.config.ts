import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * Browser smoke tests: the real app in a real browser. They start the development server on their own port against a throwaway data
 * folder in the system's temporary directory, so they can never read or change the real `data/` folder of the workspace.
 */
const PORT = 5199;
const scratch = mkdtempSync(join(tmpdir(), 'lira-e2e-'));

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  outputDir: join(scratch, 'results'),
  timeout: 45_000,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: 'retain-on-failure', screenshot: 'only-on-failure', viewport: { width: 1440, height: 900 } },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { LIRA_DATA_DIR: join(scratch, 'data') },
  },
});
