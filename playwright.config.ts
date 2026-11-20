import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4194';

export default defineConfig({
  testDir: './tests/browser',
  outputDir: 'output/browser-tests',
  use: { baseURL, channel: process.env.PLAYWRIGHT_CHANNEL },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4194 --strictPort',
    url: baseURL,
  },
});
