import { test, expect } from '../fixtures/api.fixture';
import { buildProduct } from '../test-data/productFactory';
import { HttpStatus } from '../test-data/httpStatus';
import { NON_EXISTENT_ID } from '../test-data/constants';

test.describe('Product CRUD', () => {
  // known deviation: DummyJSON does not save changes, see assertion-notes.txt
  test.fail('full CRUD flow: create, read, update, delete, verify absence', async ({ api }) => {
    const newProduct = buildProduct();
    const newPrice = 30;
    let productId = 0;

    await test.step('Create', async () => {
      const { status, body } = await api.products.add(newProduct);
      expect(status).toBe(HttpStatus.CREATED);
      expect(typeof body.id).toBe('number');
      expect(body.title).toBe(newProduct.title);
      productId = body.id;
    });

    await test.step('Read the created product', async () => {
      const { status, body } = await api.products.getById(productId);
      expect.soft(status).toBe(HttpStatus.OK);
      expect.soft(body.title).toBe(newProduct.title);
    });

    await test.step('Update the price', async () => {
      const { status, body } = await api.products.update(productId, { price: newPrice });
      expect.soft(status).toBe(HttpStatus.OK);
      expect.soft(body.price).toBe(newPrice);
    });

    await test.step('Delete', async () => {
      const { status, body } = await api.products.delete(productId);
      expect.soft(status).toBe(HttpStatus.OK);
      expect.soft(body.isDeleted).toBe(true);
    });

    await test.step('Verify the product is gone', async () => {
      const { status } = await api.products.getById(productId);
      expect(status).toBe(HttpStatus.NOT_FOUND);
    });
  });

  test('each CRUD step on an existing product returns the expected data', async ({ api }) => {
    const productId = 1;

    // Read: the response data is used by the next steps
    const { status: getStatus, body: original } = await api.products.getById(productId);
    expect(getStatus).toBe(HttpStatus.OK);
    expect(original.id).toBe(productId);

    // Update: only the price changes, the rest of the product stays the same
    const newPrice = original.price + 1;
    const { status: putStatus, body: updated } = await api.products.update(productId, { price: newPrice });
    expect(putStatus).toBe(HttpStatus.OK);
    expect(updated.id).toBe(original.id);
    expect(updated.price).toBe(newPrice);
    expect(updated.title).toBe(original.title);
    expect(updated.category).toBe(original.category);

    // Delete: the response says the same product was deleted, and when
    const { status: deleteStatus, body: deleted } = await api.products.delete(productId);
    expect(deleteStatus).toBe(HttpStatus.OK);
    expect(deleted.id).toBe(original.id);
    expect(deleted.isDeleted).toBe(true);

    // a real date from the last minute; Math.abs - the server clock can be a little ahead of ours
    const deletedAt = Date.parse(deleted.deletedOn);
    expect(deletedAt, `deletedOn "${deleted.deletedOn}" is a valid date`).not.toBeNaN();
    expect(Math.abs(Date.now() - deletedAt)).toBeLessThan(60_000);
  });

  test('GET /products/{id} for an id that does not exist returns 404 with a message', async ({ api }) => {
    const { status, body } = await api.products.getById(NON_EXISTENT_ID);

    expect(status).toBe(HttpStatus.NOT_FOUND);
    expect(body.message).toBe(`Product with id '${NON_EXISTENT_ID}' not found`);
  });
});
