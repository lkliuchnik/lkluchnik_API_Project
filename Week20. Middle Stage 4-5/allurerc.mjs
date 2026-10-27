import { defineConfig } from 'allure';

// Allure 3 report settings (npx allure generate allure-results).
// The history file keeps a short record of every run. CI keeps it between runs (a cache per
// suite and environment), so the report shows trends: the pass rate and the flaky tests over
// the last runs. Locally the history grows with every report you generate.
export default defineConfig({
  name: process.env.ALLURE_REPORT_NAME ?? 'API tests - week 20',
  output: './allure-report',
  historyPath: './allure-history/history.jsonl',
  historyLimit: 30,
  // CI turns this off when a run is only a part of the suite or a re-run, so the trend gets
  // one point per complete run
  appendHistory: process.env.ALLURE_APPEND_HISTORY !== 'false',
});
