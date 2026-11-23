import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  workers: 3,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173/gym-logbook/',
  },
  projects: [
    {
      name: 'webkit-iphone',
      use: { ...devices['iPhone 15'], viewport: { width: 393, height: 852 } },
    },
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/gym-logbook/',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
