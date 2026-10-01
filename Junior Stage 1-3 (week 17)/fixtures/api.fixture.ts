import { test as base, expect } from '@playwright/test';
import { createAuthToken } from '../helpers/bookingApi';

type Fixtures = {
  authToken: string;
};

// Gives every test a fresh auth token (no hardcoded token).
export const test = base.extend<Fixtures>({
  authToken: async ({ request }, use) => {
    const token = await createAuthToken(request);
    await use(token);
  },
});

export { expect };
