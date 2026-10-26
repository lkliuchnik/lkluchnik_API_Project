import { defineConfig } from '@playwright/test';
import { env } from './config/environments';

// Local run vs CI run - the CI variable is set by GitHub Actions (or by hand: CI=1).
//                 local              CI
//   retries       0                  1 - a test that passes only on the retry shows as "flaky"
//   reporter      list               html + list - the HTML report is kept as a CI artifact
//   forbidOnly    no                 yes - a forgotten test.only must not hide the other tests
//   trace         kept on failure    off - a trace records request bodies, the DummyJSON login
//                                    password too, and the CI report is downloadable.
//                                    The UI test turns it back on for itself (profileUi.spec.ts)
//   screenshot    -                  on failure - for the UI test
const isCI = !!process.env.CI;

// The API addresses are not here: each API has its own base URL in config/environments.ts.
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['html'], ['list']] : 'list',
  metadata: { environment: env.name }, // shown in the HTML report
  timeout: 60_000, // a DemoQA test spends 5-25 s on opening and closing its account
  expect: { timeout: 10_000 }, // the DemoQA profile page loads slowly
  use: {
    trace: isCI ? 'off' : 'retain-on-failure',
    screenshot: isCI ? 'only-on-failure' : 'off',
  },
  // No extraHTTPHeaders here: the API clients send their own JSON headers (api/createApiClient.ts),
  // so the browser pages of the UI tests are not affected.
});
