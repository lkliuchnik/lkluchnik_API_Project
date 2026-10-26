import { defineConfig, ReporterDescription } from '@playwright/test';
import { env } from './config/environments';

// Local run vs CI run - the CI variable is set by GitHub Actions (or by hand: CI=1).
//                 local              CI
//   retries       0                  1 - a test that passes only on the retry shows as "flaky"
//   reporter      list               list + blob + allure (see below)
//   forbidOnly    no                 yes - a forgotten test.only must not hide the other tests
//   trace         kept on failure    off - a trace records request bodies, the DummyJSON login
//                                    password too, and the CI report is downloadable.
//                                    The UI test turns it back on for itself (profileUi.spec.ts)
//   screenshot    -                  on failure - for the UI test
const isCI = !!process.env.CI;

// CI reporters. A CI job runs one part of a suite (one environment, maybe one shard), so it
// does not build the final reports itself - it leaves raw results, and the "report" job
// merges all parts of an environment into one HTML report, one JSON file and one Allure
// report (merge.config.ts, allurerc.mjs):
//   list               the job log
//   blob               Playwright's raw results; REPORT_PART names the file, so the parts of
//                      one environment (shard 1, shard 2, ui) do not overwrite each other
//   allure-playwright  raw results for the Allure report (one file per test, unique names)
const ciReporters: ReporterDescription[] = [
  ['list'],
  ['blob', { fileName: `report-${process.env.REPORT_PART ?? 'local'}.zip` }],
  ['allure-playwright', { resultsDir: 'allure-results', environmentInfo: { environment: env.name } }],
];

// The API addresses are not here: each API has its own base URL in config/environments.ts.
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? ciReporters : 'list',
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
