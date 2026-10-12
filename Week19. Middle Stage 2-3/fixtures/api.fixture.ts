import { test as base, expect } from '@playwright/test';
import { ApiClient } from '../api/ApiClient';
import { AuthService } from '../services/AuthService';
import { CartService } from '../services/CartService';
import { ProductService } from '../services/ProductService';
import { UserService } from '../services/UserService';
import { TEST_USER } from '../test-data/credentials';
import { HttpStatus } from '../test-data/httpStatus';

type Api = {
  auth: AuthService;
  products: ProductService;
  users: UserService;
  carts: CartService;
};

type Fixtures = {
  apiClient: ApiClient;
  api: Api;
  authToken: string;
};

export const test = base.extend<Fixtures>({
  // baseURL comes from playwright.config.ts (BASE_URL in .env)
  apiClient: async ({ request, baseURL }, use) => {
    if (!baseURL) throw new Error('baseURL is not set - check BASE_URL in .env or playwright.config.ts');
    await use(new ApiClient(request, baseURL));
  },

  api: async ({ apiClient }, use) => {
    await use({
      auth: new AuthService(apiClient),
      products: new ProductService(apiClient),
      users: new UserService(apiClient),
      carts: new CartService(apiClient),
    });
  },

  // A fresh token for every test that asks for it. Fails with a clear message if login is broken.
  authToken: async ({ api }, use) => {
    const { status, body } = await api.auth.login(TEST_USER.username, TEST_USER.password);
    expect(status, `login as ${TEST_USER.username} in the authToken fixture`).toBe(HttpStatus.OK);
    expect(body.accessToken, 'accessToken from the login response').toBeTruthy();
    await use(body.accessToken);
  },
});

export { expect };
