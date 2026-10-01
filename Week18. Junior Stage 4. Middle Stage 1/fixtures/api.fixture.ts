import { test as base, expect } from '@playwright/test';
import { getAuthToken } from '../helpers/dummyApi';

type Fixtures = {
  authToken: string;
};

// Gives every test a fresh access token (no hardcoded token).
export const test = base.extend<Fixtures>({
  authToken: async ({ request }, use) => {
    const token = await getAuthToken(request);
    await use(token);
  },
});

export { expect };
