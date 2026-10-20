import { test as base, expect } from '@playwright/test';
import { env, Environment } from '../config/environments';

type BaseFixtures = {
  env: Environment;
  apiLog: string[];
};

// Fixtures every API shares. The fixture file of each API (dummyjson.fixture.ts, ...)
// extends this one.
export const test = base.extend<BaseFixtures>({
  // the settings of the environment chosen with TEST_ENV
  env: async ({}, use) => {
    await use(env);
  },

  // Shared hook: runs for every test (auto). The logging interceptor writes into this list;
  // after the test the list is attached to the HTML report as "api-log".
  apiLog: [
    async ({}, use, testInfo) => {
      const lines: string[] = [];
      await use(lines);
      if (lines.length > 0) {
        await testInfo.attach('api-log', { body: lines.join('\n'), contentType: 'text/plain' });
      }
    },
    { auto: true },
  ],
});

export { expect };
