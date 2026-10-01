import { test, expect } from '@playwright/test';
import { addProduct, deleteProduct, getProduct, updateProduct } from '../helpers/dummyApi';
import { buildProduct } from '../test-data/productFactory';
import { HttpStatus } from '../test-data/httpStatus';

test.describe('Product CRUD', () => {
  test('full CRUD flow: create, read, update, delete, verify absence', async ({ request }) => {
    test.fail(); // known deviation: DummyJSON does not save changes, see assertion-notes.txt

    const newProduct = buildProduct();
    let productId = 0;

    await test.step('Create', async () => {
      const { status, body } = await addProduct(request, newProduct);
      expect(status).toBe(HttpStatus.CREATED);
      expect(typeof body.id).toBe('number');
      expect(body.title).toBe(newProduct.title);
      productId = body.id;
    });

    await test.step('Read the created product', async () => {
      const { status, body } = await getProduct(request, productId);
      expect.soft(status).toBe(HttpStatus.OK);
      expect.soft(body.title).toBe(newProduct.title);
    });

    await test.step('Update the price', async () => {
      const { status, body } = await updateProduct(request, productId, { price: 30 });
      expect.soft(status).toBe(HttpStatus.OK);
      expect.soft(body.price).toBe(30);
    });

    await test.step('Delete', async () => {
      const { status, body } = await deleteProduct(request, productId);
      expect.soft(status).toBe(HttpStatus.OK);
      expect.soft(body.isDeleted).toBe(true);
    });

    await test.step('Verify the product is gone', async () => {
      const { status } = await getProduct(request, productId);
      expect(status).toBe(HttpStatus.NOT_FOUND);
    });
  });

  test('each CRUD step on an existing product returns the expected data', async ({ request }) => {
    const productId = 1;

    // Read: the response data is used by the next steps
    const { status: getStatus, body: original } = await getProduct(request, productId);
    expect(getStatus).toBe(HttpStatus.OK);
    expect(original.id).toBe(productId);

    // Update: only the price changes, the rest of the product stays the same
    const newPrice = original.price + 1;
    const { status: putStatus, body: updated } = await updateProduct(request, productId, { price: newPrice });
    expect(putStatus).toBe(HttpStatus.OK);
    expect(updated.id).toBe(original.id);
    expect(updated.price).toBe(newPrice);
    expect(updated.title).toBe(original.title);
    expect(updated.category).toBe(original.category);

    // Delete: the response says the same product was deleted, and when
    const { status: deleteStatus, body: deleted } = await deleteProduct(request, productId);
    expect(deleteStatus).toBe(HttpStatus.OK);
    expect(deleted.id).toBe(original.id);
    expect(deleted.isDeleted).toBe(true);
    expect(Date.now() - Date.parse(deleted.deletedOn)).toBeLessThan(60_000);
  });

  test('GET /products/{id} for an id that does not exist returns 404 with a message', async ({ request }) => {
    const { status, body } = await getProduct(request, 99999);

    expect(status).toBe(HttpStatus.NOT_FOUND);
    expect(body.message).toBe("Product with id '99999' not found");
  });
});
