// Test tags: which suite a test belongs to. One place for the names - a typo in a tag would
// silently drop a test from a suite, so specs use these constants, never the plain text.
//
//   smoke        one or two happy paths per API: "is everything up and wired?" Each one makes
//                as few requests as possible, so smoke stays fast also when a public server
//                is slow (DemoQA: open and close one account). Runs on every pull request.
//   regression   every test except the slow ones. Runs on every push to main.
//   slow         waits a long time (a real 1-minute token). Only in the full suite.
//   ui           needs a browser. Runs in its own CI job.
//
// A smoke test is also a regression test: it sits in a describe block tagged REGRESSION
// and adds SMOKE itself. The suites are npm scripts (package.json), so CI and a local run
// use the same definitions:
//   npm run test:smoke        --grep @smoke
//   npm run test:regression   --grep @regression
//   npm run test:full         everything
export const Tag = {
  SMOKE: '@smoke',
  REGRESSION: '@regression',
  SLOW: '@slow',
  UI: '@ui',
} as const;
