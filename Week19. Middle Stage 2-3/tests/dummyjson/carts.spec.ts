import { test, expect } from '../../fixtures/dummyjson.fixture';
import { expectCartTotalsConsistent } from '../../assertions/dummyjson/cartAssertions';
import { HttpStatus } from '../../test-data/httpStatus';
import { NON_EXISTENT_ID } from '../../test-data/dummyjson/constants';

test.describe('Cart business rules', () => {
  test('the logged-in user sees only their own carts, with correct totals', async ({ api, authToken, env }) => {
    // Step 1: the token (from the login in the fixture) tells us who the user is
    const { status: meStatus, body: me } = await api.auth.getCurrentUser(authToken);
    expect(meStatus, 'precondition: GET /auth/me').toBe(HttpStatus.OK);
    expect(me.username).toBe(env.dummyjson.username);

    // Step 2: the user id from step 1 is used to load the carts
    const { status, body } = await api.carts.getByUser(me.id, authToken);
    expect(status).toBe(HttpStatus.OK);
    expect(body.carts.length).toBeGreaterThan(0);

    for (const cart of body.carts) {
      expect(cart.userId).toBe(me.id);
      await expectCartTotalsConsistent(cart);
    }
  });

  test('a new cart uses catalog prices and calculates the totals', async ({ api, authToken }) => {
    const { status: meStatus, body: me } = await api.auth.getCurrentUser(authToken);
    const { status: status1, body: product1 } = await api.products.getById(1);
    const { status: status2, body: product2 } = await api.products.getById(2);
    expect(meStatus, 'precondition: GET /auth/me').toBe(HttpStatus.OK);
    expect(status1, 'precondition: product 1 exists').toBe(HttpStatus.OK);
    expect(status2, 'precondition: product 2 exists').toBe(HttpStatus.OK);

    const { status, body: cart } = await api.carts.add(me.id, [
      { id: product1.id, quantity: 2 },
      { id: product2.id, quantity: 1 },
    ]);

    expect(status).toBe(HttpStatus.CREATED);
    expect(cart.userId).toBe(me.id);

    // the cart must use the prices from the catalog, not some other price
    const line1 = cart.products.find((line) => line.id === product1.id);
    const line2 = cart.products.find((line) => line.id === product2.id);
    if (!line1 || !line2) {
      throw new Error(`product ${product1.id} or ${product2.id} is missing from the new cart`);
    }
    expect(line1.price).toBe(product1.price);
    expect(line2.price).toBe(product2.price);

    // expected values worked out here, independently of the shared check below
    expect(line1.total).toBeCloseTo(product1.price * 2, 2);
    expect(line2.total).toBeCloseTo(product2.price * 1, 2);
    expect(cart.total).toBeCloseTo(product1.price * 2 + product2.price, 2);
    expect(cart.totalQuantity).toBe(3);
    expect(cart.totalProducts).toBe(2);

    await expectCartTotalsConsistent(cart);
  });

  test('a cart for a user that does not exist is rejected', async ({ api }) => {
    const { status, body } = await api.carts.add(NON_EXISTENT_ID, [{ id: 1, quantity: 1 }]);

    expect(status).toBe(HttpStatus.NOT_FOUND);
    expect(body.message).toBe(`User with id '${NON_EXISTENT_ID}' not found`);
  });
});
