// Used only by the CI "report" job: it merges the raw results of all parts of one environment
// (the shards and the UI test) into the final reports.
//   npx playwright merge-reports --config merge.config.ts <folder with the blob files>
//   html   playwright-report/   - the report to open in a browser
//   json   reports/results.json - for the run summary (scripts/ci-summary.js) and for AI triage
export default {
  testDir: './tests',
  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: 'reports/results.json' }],
  ],
};
