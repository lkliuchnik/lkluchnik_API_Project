import { test, expect, DummyJsonApi } from '../../fixtures/dummyjson.fixture';
import { HttpStatus } from '../../test-data/httpStatus';
import { Tag } from '../../config/tags';

// Boundary value analysis: for every parameter the values just below, on and just above
// each limit. Limits that depend on data (the number of products) are read from the API,
// not written into the test. Where DummyJSON answers differently from a correct API,
// the case is marked test.fail - see assertion-notes.txt.

async function productTotal(api: DummyJsonApi) {
  const { status, body } = await api.products.getPage(1, 0);
  expect(status, 'precondition: GET /products').toBe(HttpStatus.OK);
  return body.total;
}

// GET /products?limit= : how many products one page has. 0 means "no limit" (DummyJSON docs).
// Each case: the limit sent and the number of products expected back, both from the total.
const acceptedLimits = [
  { title: '0 means no limit: all products', limit: () => 0, items: (total: number) => total },
  { title: 'the minimum: 1 product', limit: () => 1, items: () => 1 },
  { title: 'just above the minimum: 2 products', limit: () => 2, items: () => 2 },
  { title: 'just below the maximum: total - 1', limit: (total: number) => total - 1, items: (total: number) => total - 1 },
  { title: 'the maximum: total', limit: (total: number) => total, items: (total: number) => total },
  { title: 'above the maximum: total + 1 gives all products', limit: (total: number) => total + 1, items: (total: number) => total },
];

test.describe('Boundaries: GET /products limit', { tag: Tag.REGRESSION }, () => {
  test('below the minimum: limit -1 is rejected', async ({ api }) => {
    const { status, body } = await api.products.getPage(-1, 0);

    expect(status).toBe(HttpStatus.BAD_REQUEST);
    expect(body.message).toBe("Invalid 'limit' - should be a positive number");
  });

  for (const c of acceptedLimits) {
    test(c.title, async ({ api }) => {
      const total = await productTotal(api);

      const { status, body } = await api.products.getPage(c.limit(total), 0);

      expect(status).toBe(HttpStatus.OK);
      expect(body.products).toHaveLength(c.items(total));
      expect(body.total).toBe(total);
    });
  }
});

// GET /products?skip= : how many products to jump over, with pages of 10.
const PAGE_SIZE = 10;
const acceptedSkips = [
  { title: 'the minimum: 0 gives a full first page', skip: () => 0, items: PAGE_SIZE },
  { title: 'the last product: total - 1 leaves 1 product', skip: (total: number) => total - 1, items: 1 },
  { title: 'the end: total leaves an empty page', skip: (total: number) => total, items: 0 },
  { title: 'past the end: total + 1 is an empty page, not an error', skip: (total: number) => total + 1, items: 0 },
];

test.describe('Boundaries: GET /products skip', { tag: Tag.REGRESSION }, () => {
  test('below the minimum: skip -1 is rejected', async ({ api }) => {
    const { status, body } = await api.products.getPage(PAGE_SIZE, -1);

    expect(status).toBe(HttpStatus.BAD_REQUEST);
    expect(body.message).toBe("Invalid 'skip' - should be a positive number");
  });

  for (const c of acceptedSkips) {
    test(c.title, async ({ api }) => {
      const total = await productTotal(api);
      const skip = c.skip(total);

      const { status, body } = await api.products.getPage(PAGE_SIZE, skip);

      expect(status).toBe(HttpStatus.OK);
      expect(body.products).toHaveLength(c.items);
      expect(body.skip).toBe(skip);
    });
  }
});

// GET /test?delay= : the server waits this many milliseconds before it answers. Max 5000.
const MAX_DELAY_MS = 5000;

test.describe('Boundaries: GET /test delay', { tag: Tag.REGRESSION }, () => {
  const rejected = [
    {
      title: 'below the minimum: delay -1 is rejected',
      delay: -1,
      error: 'Delay should be a positive number in milliseconds',
    },
    {
      title: `above the maximum: ${MAX_DELAY_MS + 1} ms is rejected`,
      delay: MAX_DELAY_MS + 1,
      error: 'Delay should be less than 5 seconds (5000 milliseconds)',
    },
  ];
  for (const c of rejected) {
    test(c.title, async ({ apiClient }) => {
      const { status, body } = await apiClient.get('/test', { params: { delay: c.delay } });

      expect(status).toBe(HttpStatus.BAD_REQUEST);
      expect(body.message).toBe(c.error);
    });
  }

  // No upper time limit in these checks: how fast an answer comes depends on the network,
  // and a test must not depend on timing. A lower limit is safe - the server must wait.
  test('the minimum: 0 is accepted', async ({ apiClient }) => {
    const { status, body } = await apiClient.get<{ status: string }>('/test', { params: { delay: 0 } });

    expect(status).toBe(HttpStatus.OK);
    expect(body.status).toBe('ok');
  });

  test(`the maximum: ${MAX_DELAY_MS} ms is waited for`, async ({ apiClient }) => {
    const { status, body, durationMs } = await apiClient.get<{ status: string }>('/test', {
      params: { delay: MAX_DELAY_MS },
    });

    expect(status).toBe(HttpStatus.OK);
    expect(body.status).toBe('ok');
    expect(durationMs, 'the server waited the whole delay').toBeGreaterThanOrEqual(MAX_DELAY_MS);
  });
});

// POST /auth/login expiresInMins: how long the access token lives. 1 to 43200 minutes (30 days).
// The lifetime is read from the token itself: exp - iat in its payload, in seconds.
function tokenLifetimeSeconds(token: string) {
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  return payload.exp - payload.iat;
}

const MAX_TOKEN_MINUTES = 43200;

test.describe('Boundaries: POST /auth/login expiresInMins', { tag: Tag.REGRESSION }, () => {
  // known deviation: 200 and a token for 30 days - the longest one, not a rejection
  test.fail('below the minimum: 0 minutes is rejected', async ({ api, env }) => {
    const { status } = await api.auth.login(env.dummyjson.username, env.dummyjson.password, 0);

    expect(status).toBe(HttpStatus.BAD_REQUEST);
  });

  const accepted = [
    { title: 'the minimum: 1 minute', minutes: 1 },
    { title: `the maximum: ${MAX_TOKEN_MINUTES} minutes (30 days)`, minutes: MAX_TOKEN_MINUTES },
  ];
  for (const c of accepted) {
    test(`${c.title} gives a token for exactly that time`, async ({ api, env }) => {
      const { status, body } = await api.auth.login(env.dummyjson.username, env.dummyjson.password, c.minutes);

      expect(status).toBe(HttpStatus.OK);
      expect(tokenLifetimeSeconds(body.accessToken)).toBe(c.minutes * 60);
    });
  }

  // known deviation: 500 instead of 400 (the message itself is right)
  test.fail(`above the maximum: ${MAX_TOKEN_MINUTES + 1} minutes is rejected with 400`, async ({ api, env }) => {
    const { status, body } = await api.auth.login(
      env.dummyjson.username,
      env.dummyjson.password,
      MAX_TOKEN_MINUTES + 1,
    );

    expect(status).toBe(HttpStatus.BAD_REQUEST);
    expect(body.message).toBe('Maximum access token expire time can be 43200 minutes');
  });
});
