import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', testMatch: '**/*.spec.ts', timeout: 30000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:4173', headless: true,
    launchOptions: { executablePath: process.env.DOCX_TEST_BROWSER },
  },
  webServer: { command: 'npm run preview -- --port 4173 --strictPort', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI },
});
