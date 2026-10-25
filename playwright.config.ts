import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './e2e', testMatch: '*.pw.ts', fullyParallel: false,
  outputDir: '/tmp/zhitan-browser-results',
  use: { baseURL: 'http://127.0.0.1:5174', headless: true,
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] } },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5174 --strictPort', url: 'http://127.0.0.1:5174', reuseExistingServer: false },
})
