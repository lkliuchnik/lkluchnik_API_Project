import { test as base, expect } from '@playwright/test';
import { createAuthToken } from '../helpers/bookingApi';

type Fixtures = {
  authToken: string;
};

// Extends Playwright's base test with a ready-to-use auth token, obtained
// dynamically per test instead of hardcoding one.
export const test = base.extend<Fixtures>({
  authToken: async ({ request }, use) => {
    const token = await createAuthToken(request);
    await use(token);
  },
});

export { expect };
