import { test, DummyJsonApi } from '../../fixtures/dummyjson.fixture';
import { expectDummyJsonError } from '../../assertions/dummyjson/errorAssertions';
import { Environment } from '../../config/environments';
import { ApiResponse } from '../../models/common';
import { NON_EXISTENT_ID } from '../../test-data/dummyjson/constants';
import { HttpStatus } from '../../test-data/httpStatus';

// Error consistency: every DummyJSON endpoint answers an error the same way -
// a JSON body of exactly { message } (expectDummyJsonError). Different endpoints,
// different reasons (not found, no login, bad input), one shape.

type ErrorCase = {
  title: string; // endpoint - what is wrong with the request
  send: (api: DummyJsonApi, env: Environment) => Promise<ApiResponse<unknown>>;
  status: number;
  message: string;
};

const cases: ErrorCase[] = [
  {
    title: 'GET /products/{id} - unknown id',
    send: (api) => api.products.getById(NON_EXISTENT_ID),
    status: HttpStatus.NOT_FOUND,
    message: `Product with id '${NON_EXISTENT_ID}' not found`,
  },
  {
    title: 'GET /users/{id} - unknown id',
    send: (api) => api.users.getById(NON_EXISTENT_ID),
    status: HttpStatus.NOT_FOUND,
    message: `User with id '${NON_EXISTENT_ID}' not found`,
  },
  {
    title: 'GET /posts/{id} - unknown id',
    send: (api) => api.posts.getById(NON_EXISTENT_ID),
    status: HttpStatus.NOT_FOUND,
    message: `Post with id '${NON_EXISTENT_ID}' not found`,
  },
  {
    title: 'GET /auth/me - no token',
    send: (api) => api.auth.getCurrentUser(),
    status: HttpStatus.UNAUTHORIZED,
    message: 'Access Token is required',
  },
  {
    title: 'POST /auth/login - wrong password',
    send: (api, env) => api.auth.login(env.dummyjson.username, 'wrong-password'),
    status: HttpStatus.BAD_REQUEST,
    message: 'Invalid credentials',
  },
  {
    title: 'GET /products - limit below the minimum',
    send: (api) => api.products.getPage(-1, 0),
    status: HttpStatus.BAD_REQUEST,
    message: "Invalid 'limit' - should be a positive number",
  },
];

test.describe('DummyJSON errors have one shape on every endpoint', () => {
  for (const c of cases) {
    test(`${c.title}: ${c.status} with { message }`, async ({ api, env }) => {
      const response = await c.send(api, env);

      await expectDummyJsonError(response, { status: c.status, message: c.message });
    });
  }

  // known deviation: an address that is not an endpoint answers 404 with an HTML page
  test.fail('an unknown address: 404 with { message }, like every endpoint', async ({ apiClient }) => {
    const response = await apiClient.get('/no-such-endpoint');

    await expectDummyJsonError(response, { status: HttpStatus.NOT_FOUND });
  });
});
