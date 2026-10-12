import { defineConfig } from '@playwright/test';
import { env } from './config/environments';

// The API addresses are not here: each API has its own base URL in config/environments.ts.
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html'], ['list']] : 'list',
  metadata: { environment: env.name }, // shown in the HTML report
  // No extraHTTPHeaders here: the API clients send their own JSON headers (api/createApiClient.ts),
  // so the browser pages of the UI tests are not affected.
});
