import { test, expect } from '../fixtures/api.fixture';
import { getCartsOfUser, getCurrentUser, getProtectedProducts, login } from '../helpers/dummyApi';
import { HttpStatus } from '../test-data/httpStatus';

test.describe('Access control', () => {
  test('GET /auth/products without a token is rejected with 401', async ({ request }) => {
    const { status, body } = await getProtectedProducts(request);

    expect(status).toBe(HttpStatus.UNAUTHORIZED);
    expect(body.message).toBe('Access Token is required');
    expect(body.products).toBeUndefined(); // no data leaks in the error response
  });

  test('GET /auth/products with a valid token returns products', async ({ request, authToken }) => {
    const { status, body } = await getProtectedProducts(request, authToken);

    expect(status).toBe(HttpStatus.OK);
    expect(body.products.length).toBeGreaterThan(0);
  });

  test('GET /auth/products with a random string as token is rejected with 401', async ({ request }) => {
    const { status, body } = await getProtectedProducts(request, 'not-a-real-token');

    expect(status).toBe(HttpStatus.UNAUTHORIZED);
    expect(body.message).toBe('Invalid/Expired Token!');
  });

  test('GET /auth/products with a real token but a forged signature is rejected with 401', async ({
    request,
    authToken,
  }) => {
    test.fail(); // known deviation: the API returns 500, see assertion-notes.txt

    const forgedToken = authToken.slice(0, -5) + 'AAAAA'; // change the end of the signature

    const { status } = await getProtectedProducts(request, forgedToken);

    expect(status).toBe(HttpStatus.UNAUTHORIZED);
  });

  test('user A cannot read the carts of user B', async ({ request, authToken }) => {
    test.fail(); // known deviation: the API returns 200 with the data, see assertion-notes.txt

    const { body: me } = await getCurrentUser(request, authToken);
    const otherUserId = me.id + 1;

    const { status } = await getCartsOfUser(request, otherUserId, authToken);

    expect(status).toBe(HttpStatus.FORBIDDEN);
  });
});

test.describe('Login validation', () => {
  test('login with a wrong password is rejected with a clear message', async ({ request }) => {
    const { status, body } = await login(request, 'emilys', 'wrong-password');

    expect(status).toBe(HttpStatus.BAD_REQUEST);
    expect(body.message).toBe('Invalid credentials');
    expect(body.accessToken).toBeUndefined();
  });

  test('login without a password is rejected with a clear message', async ({ request }) => {
    const { status, body } = await login(request, 'emilys', '');

    expect(status).toBe(HttpStatus.BAD_REQUEST);
    expect(body.message).toBe('Username and password required');
  });
});
