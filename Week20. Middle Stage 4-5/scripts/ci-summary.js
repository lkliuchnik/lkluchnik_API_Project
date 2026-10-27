// The run summary for GitHub Actions: reads the merged Playwright JSON report and prints a short
// Markdown table - the CI metrics of one suite in one environment. The CI "report" job appends
// it to the run's Summary page:
//   node scripts/ci-summary.js reports/results.json <suite> <environment> [found parts] [expected parts]
//
// What is counted (one line per test, the final outcome after the CI retry):
//   passed            the test passed
//   known deviations  test.fail tests that failed as expected (assertion-notes.txt)
//   failed            the test failed, also after the retry - the run is red
//   flaky             failed first, passed on the retry - green, but worth a look
//   skipped           skipped on purpose (for example a gateway error in a bulk test)
// Pass rate = (passed + known deviations + flaky) / (all tests - skipped): the share of tests
// that ended green. Flaky tests have their own column, so they are not hidden.
//
// The parts: a run can be split (shards, the UI job). If fewer parts finished than were
// planned, the numbers cover only part of the suite - the summary says so first.
const fs = require('fs');

const [reportPath, suite = '?', environment = '?', foundParts, expectedParts] = process.argv.slice(2);
const lines = [`### ${suite} - ${environment}`, ''];
if (foundParts !== undefined && expectedParts !== undefined && Number(foundParts) < Number(expectedParts)) {
  lines.push(
    `**WARNING: only ${foundParts} of ${expectedParts} parts of this run finished - the numbers below are incomplete.**`,
    '',
  );
}
if (!reportPath || !fs.existsSync(reportPath)) {
  lines.push(`No test results: ${reportPath} was not created.`);
  console.log(lines.join('\n'));
  process.exit(0);
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const tests = [];
const collect = (suiteNode, path) => {
  for (const spec of suiteNode.specs ?? []) {
    for (const test of spec.tests) tests.push({ title: [...path, spec.title].join(' > '), test });
  }
  for (const child of suiteNode.suites ?? []) collect(child, [...path, child.title]);
};
for (const fileSuite of report.suites) collect(fileSuite, [fileSuite.title]);

const outcome = ({ test }) => {
  if (test.status === 'skipped') return 'skipped';
  if (test.status === 'flaky') return 'flaky';
  if (test.status === 'unexpected') return 'failed';
  return test.expectedStatus === 'failed' ? 'known deviation' : 'passed';
};
const count = (name) => tests.filter((t) => outcome(t) === name).length;
const counted = tests.length - count('skipped');
const green = count('passed') + count('known deviation') + count('flaky');
const passRate = counted ? `${Math.round((green / counted) * 1000) / 10}%` : 'n/a';
const totalSeconds = Math.round(report.stats.duration / 1000);
const time = `${Math.floor(totalSeconds / 60)} min ${totalSeconds % 60} s`;

lines.push(
  '| tests | passed | known deviations | failed | flaky | skipped | pass rate | time |',
  '|---|---|---|---|---|---|---|---|',
  `| ${tests.length} | ${count('passed')} | ${count('known deviation')} | ${count('failed')} | ${count('flaky')} | ` +
    `${count('skipped')} | ${passRate} | ${time} |`,
);
for (const kind of ['failed', 'flaky']) {
  const list = tests.filter((t) => outcome(t) === kind);
  if (list.length) lines.push('', `**${kind}:**`, ...list.map((t) => `- ${t.title}`));
}
console.log(lines.join('\n'));
