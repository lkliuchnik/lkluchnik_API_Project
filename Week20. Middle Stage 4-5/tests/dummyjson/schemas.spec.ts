import { test, expect } from '../../fixtures/dummyjson.fixture';
import { expectSchema } from '../../assertions/schemaAssertions';
import { HttpStatus } from '../../test-data/httpStatus';
import { Tag } from '../../config/tags';

// Schema validation for the key DummyJSON answers: login, the user's profile, a page of the
// catalog, a new cart. The schemas are in schemas/dummyjson/ - practical ones we keep
// ourselves: the fields the tests and a client rely on, with their types. New fields are
// allowed. How a schema change is reviewed: helpers/schema-changes.txt.

test.describe('DummyJSON answers match their schemas', { tag: Tag.REGRESSION }, () => {
  test('POST /auth/login answers a login: two tokens and the user', async ({ api, env }) => {
    const { status, body } = await api.auth.login(env.dummyjson.username, env.dummyjson.password);

    expect(status).toBe(HttpStatus.OK);
    await expectSchema(body, 'dummyjson/login');
  });

  test('GET /auth/me answers the profile of the logged-in user', async ({ authApi }) => {
    const { status, body } = await authApi.auth.getCurrentUser();

    expect(status).toBe(HttpStatus.OK);
    await expectSchema(body, 'dummyjson/user');
  });

  test('GET /products answers a page of the catalog', async ({ api }) => {
    const { status, body } = await api.products.getPage(10, 0);

    expect(status).toBe(HttpStatus.OK);
    await expectSchema(body, 'dummyjson/products-page');
  });

  test('POST /carts/add answers a cart with its lines and totals', async ({ api }) => {
    const { status, body } = await api.carts.add(1, [{ id: 1, quantity: 2 }]);

    expect(status).toBe(HttpStatus.CREATED);
    await expectSchema(body, 'dummyjson/cart');
  });

  // known deviation: the profile carries the user's password in plain text (assertion-notes.txt, 38)
  test.fail('GET /auth/me never sends the password back', async ({ authApi }) => {
    const { status, body } = await authApi.auth.getCurrentUser();

    expect(status).toBe(HttpStatus.OK);
    await expectSchema(body, 'dummyjson/user-without-secrets');
  });
});
