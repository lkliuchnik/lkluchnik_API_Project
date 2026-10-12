import { test as base, expect } from './base.fixture';
import { ApiClient } from '../api/ApiClient';
import { createApiClient } from '../api/createApiClient';
import { authInterceptor } from '../api/interceptors/auth';
import { AuthService } from '../services/dummyjson/AuthService';
import { CartService } from '../services/dummyjson/CartService';
import { DummyJsonSession } from '../services/dummyjson/DummyJsonSession';
import { ProductService } from '../services/dummyjson/ProductService';
import { UserService } from '../services/dummyjson/UserService';

// All DummyJSON services on one client. A new service is added here - one line.
function servicesFor(client: ApiClient) {
  return {
    auth: new AuthService(client),
    products: new ProductService(client),
    users: new UserService(client),
    carts: new CartService(client),
  };
}

export type DummyJsonApi = ReturnType<typeof servicesFor>;

type DummyJsonFixtures = {
  apiClient: ApiClient; // client without auth - for the smoke test
  api: DummyJsonApi; // services without auth: a request has a token only if the test passes one
  session: DummyJsonSession; // logs in as the environment's test user
  authApi: DummyJsonApi; // services with the auth interceptor: every request is logged in
  authToken: string; // a fresh token, for tests that pass it by hand
};

export const test = base.extend<DummyJsonFixtures>({
  apiClient: async ({ request, env, apiLog }, use) => {
    await use(createApiClient(request, { baseUrl: env.dummyjson.baseUrl, http: env.http, log: apiLog }));
  },

  api: async ({ apiClient }, use) => {
    await use(servicesFor(apiClient));
  },

  session: async ({ api, env }, use) => {
    await use(new DummyJsonSession(api.auth, env.dummyjson));
  },

  authApi: async ({ request, env, apiLog, session }, use) => {
    const client = createApiClient(request, {
      baseUrl: env.dummyjson.baseUrl,
      http: env.http,
      log: apiLog,
      auth: authInterceptor(session),
    });
    await use(servicesFor(client));
  },

  authToken: async ({ session }, use) => {
    await use(await session.getToken());
  },

});

export { expect };
