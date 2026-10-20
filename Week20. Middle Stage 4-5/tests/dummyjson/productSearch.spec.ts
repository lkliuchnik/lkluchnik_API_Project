import { test, expect } from '../../fixtures/dummyjson.fixture';
import { HttpStatus } from '../../test-data/httpStatus';

// A new endpoint in an existing service: one method, ProductService.search(), and this
// test. Nothing else in the project changed. See helpers/README.txt, part 7.
test.describe('Product search', () => {
  test('search returns only products whose title or description contains the word', async ({ api }) => {
    const word = 'phone';

    const { status, body } = await api.products.search(word);

    expect(status).toBe(HttpStatus.OK);
    expect(body.products.length).toBeGreaterThan(0);
    expect(body.total).toBe(body.products.length);
    for (const product of body.products) {
      const text = `${product.title} ${product.description}`.toLowerCase();
      expect(text, `product ${product.id} matches "${word}"`).toContain(word);
    }
  });

  test('search for a word that no product has returns an empty list', async ({ api }) => {
    const { status, body } = await api.products.search('zzzqqq');

    expect(status).toBe(HttpStatus.OK);
    expect(body.products).toEqual([]);
    expect(body.total).toBe(0);
  });
});
