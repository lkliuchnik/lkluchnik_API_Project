import { expect, test } from '@playwright/test';
import { Cart } from '../../models/dummyjson/cart';

// Business rules every cart must follow, whatever products are in it.
// box: true - a failure is reported at the line in the test that called this function.
export async function expectCartTotalsConsistent(cart: Cart) {
  await test.step(
    `cart ${cart.id}: totals match its lines`,
    async () => {
      let sumOfLines = 0;
      let sumOfQuantities = 0;
      for (const line of cart.products) {
        expect(line.total, `line total of product ${line.id}`).toBeCloseTo(line.price * line.quantity, 2);
        sumOfLines += line.total;
        sumOfQuantities += line.quantity;
      }

      expect(cart.total, 'cart total = sum of line totals').toBeCloseTo(sumOfLines, 2);
      expect(cart.totalQuantity, 'totalQuantity = sum of quantities').toBe(sumOfQuantities);
      expect(cart.totalProducts, 'totalProducts = number of lines').toBe(cart.products.length);
      expect(cart.discountedTotal, 'a discount never makes the cart more expensive').toBeLessThanOrEqual(cart.total);
    },
    { box: true },
  );
}
