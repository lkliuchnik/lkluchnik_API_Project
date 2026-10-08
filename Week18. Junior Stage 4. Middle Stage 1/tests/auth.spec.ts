import { test, expect } from '../fixtures/api.fixture';
import { HttpStatus } from '../test-data/httpStatus';
import { TEST_USER } from '../test-data/credentials';

test.describe('Access control', () => {
  const PAGE_SIZE = 5; // the access check does not need more products

  test('GET /auth/products without a token is rejected with 401', async ({ api }) => {
    const { status, body } = await api.products.getProtectedPage(PAGE_SIZE);

    expect(status).toBe(HttpStatus.UNAUTHORIZED);
    expect(body.message).toBe('Access Token is required');
    expect(body.products).toBeUndefined(); // no data leaks in the error response
  });

  test('GET /auth/products with a valid token returns products', async ({ api, authToken }) => {
    const { status, body } = await api.products.getProtectedPage(PAGE_SIZE, authToken);

    expect(status).toBe(HttpStatus.OK);
    expect(body.products.length).toBeGreaterThan(0);
  });

  test('GET /auth/products with a random string as token is rejected with 401', async ({ api }) => {
    const { status, body } = await api.products.getProtectedPage(PAGE_SIZE, 'not-a-real-token');

    expect(status).toBe(HttpStatus.UNAUTHORIZED);
    expect(body.message).toBe('Invalid/Expired Token!');
  });

  // known deviation: the API returns 500, see assertion-notes.txt
  test.fail('GET /auth/products with a real token but a forged signature is rejected with 401', async ({
    api,
    authToken,
  }) => {
    const forgedToken = authToken.slice(0, -5) + 'AAAAA'; // change the end of the signature

    const { status } = await api.products.getProtectedPage(PAGE_SIZE, forgedToken);

    expect(status).toBe(HttpStatus.UNAUTHORIZED);
  });

  // known deviation: the API returns 200 with the data, see assertion-notes.txt
  test.fail('user A cannot read the carts of user B', async ({ api, authToken }) => {
    const { status: meStatus, body: me } = await api.auth.getCurrentUser(authToken);
    expect(meStatus, 'precondition: GET /auth/me').toBe(HttpStatus.OK);

    const otherUserId = me.id + 1;
    const { status: otherStatus } = await api.users.getById(otherUserId);
    expect(otherStatus, `precondition: user ${otherUserId} exists`).toBe(HttpStatus.OK);

    const { status } = await api.carts.getByUser(otherUserId, authToken);

    expect(status).toBe(HttpStatus.FORBIDDEN);
  });
});

test.describe('Login validation', () => {
  test('login with a wrong password is rejected with a clear message', async ({ api }) => {
    const { status, body } = await api.auth.login(TEST_USER.username, 'wrong-password');

    expect(status).toBe(HttpStatus.BAD_REQUEST);
    expect(body.message).toBe('Invalid credentials');
    expect(body.accessToken).toBeUndefined();
  });

  test('login without a password is rejected with a clear message', async ({ api }) => {
    const { status, body } = await api.auth.login(TEST_USER.username, '');

    expect(status).toBe(HttpStatus.BAD_REQUEST);
    expect(body.message).toBe('Username and password required');
  });
});
