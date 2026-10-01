import { test, expect } from '../fixtures/api.fixture';
import { addCart, getCartsOfUser, getCurrentUser, getProduct } from '../helpers/dummyApi';
import { HttpStatus } from '../test-data/httpStatus';

test.describe('Cart business rules', () => {
  test('the logged-in user sees only their own carts, with correct totals', async ({ request, authToken }) => {
    // Step 1: the token (from the login in the fixture) tells us who the user is
    const { status: meStatus, body: me } = await getCurrentUser(request, authToken);
    expect(meStatus).toBe(HttpStatus.OK);
    expect(me.username).toBe(process.env.AUTH_USERNAME ?? 'emilys');

    // Step 2: the user id from step 1 is used to load the carts
    const { status, body } = await getCartsOfUser(request, me.id, authToken);
    expect(status).toBe(HttpStatus.OK);
    expect(body.carts.length).toBeGreaterThan(0);

    for (const cart of body.carts) {
      expect(cart.userId).toBe(me.id);

      let sumOfLines = 0;
      let sumOfQuantities = 0;
      for (const line of cart.products) {
        expect(line.total).toBeCloseTo(line.price * line.quantity, 2);
        sumOfLines += line.total;
        sumOfQuantities += line.quantity;
      }

      expect(cart.total).toBeCloseTo(sumOfLines, 2);
      expect(cart.totalQuantity).toBe(sumOfQuantities);
      expect(cart.totalProducts).toBe(cart.products.length);
      expect(cart.discountedTotal).toBeLessThanOrEqual(cart.total);
    }
  });

  test('a new cart uses catalog prices and calculates the totals', async ({ request, authToken }) => {
    const { body: me } = await getCurrentUser(request, authToken);
    const { body: product1 } = await getProduct(request, 1);
    const { body: product2 } = await getProduct(request, 2);

    const { status, body: cart } = await addCart(request, me.id, [
      { id: product1.id, quantity: 2 },
      { id: product2.id, quantity: 1 },
    ]);

    expect(status).toBe(HttpStatus.CREATED);
    expect(cart.userId).toBe(me.id);

    // the cart must use the prices from the catalog, not some other price
    const line1 = cart.products.find((line: { id: number }) => line.id === product1.id);
    const line2 = cart.products.find((line: { id: number }) => line.id === product2.id);
    expect(line1.price).toBe(product1.price);
    expect(line2.price).toBe(product2.price);

    expect(line1.total).toBeCloseTo(product1.price * 2, 2);
    expect(line2.total).toBeCloseTo(product2.price * 1, 2);
    expect(cart.total).toBeCloseTo(product1.price * 2 + product2.price, 2);
    expect(cart.totalQuantity).toBe(3);
    expect(cart.totalProducts).toBe(2);
  });

  test('a cart for a user that does not exist is rejected', async ({ request }) => {
    const { status, body } = await addCart(request, 99999, [{ id: 1, quantity: 1 }]);

    expect(status).toBe(HttpStatus.NOT_FOUND);
    expect(body.message).toBe("User with id '99999' not found");
  });
});
