import { test, expect } from '../../fixtures/bookstore.fixture';
import { expectSchema } from '../../assertions/schemaAssertions';
import { buildCredentials } from '../../test-data/bookstore/accountFactory';
import { HttpStatus } from '../../test-data/httpStatus';
import { Tag } from '../../config/tags';

// Schema validation for the key DemoQA answers: the catalog, a new account, a login, and a
// reader's account with a book in it. The schemas are in schemas/bookstore/ - practical ones
// we keep ourselves. New fields are allowed. How a schema change is reviewed:
// helpers/schema-changes.txt.

test.describe('DemoQA answers match their schemas', { tag: Tag.REGRESSION }, () => {
  test('GET /BookStore/v1/Books answers the catalog: books with an ISBN and their details', async ({ bookstore }) => {
    const { status, body } = await bookstore.books.getCatalog();

    expect(status).toBe(HttpStatus.OK);
    await expectSchema(body, 'bookstore/books');
  });

  test('POST /Account/v1/User answers a new account with an empty collection', async ({ bookstore, accountCleanup }) => {
    const credentials = buildCredentials();

    const { status, body } = await bookstore.account.create(credentials);

    if (status === HttpStatus.CREATED) accountCleanup.remember({ ...credentials, userId: body.userID });
    expect(status).toBe(HttpStatus.CREATED);
    await expectSchema(body, 'bookstore/created-account');
  });

  test('POST /Account/v1/GenerateToken answers a token and when it expires', async ({ bookstore, newReader }) => {
    const reader = await newReader();

    const { status, body } = await bookstore.account.generateToken(reader);

    expect(status).toBe(HttpStatus.OK);
    await expectSchema(body, 'bookstore/token');
  });

  test("GET /Account/v1/User/{userId} answers the reader's account with its books", async ({
    reader,
    readerApi,
    catalog,
  }) => {
    const { status: added } = await readerApi.books.addBooks(reader.userId, [catalog[0].isbn]);
    expect(added, 'precondition: POST /BookStore/v1/Books').toBe(HttpStatus.CREATED);

    const { status, body } = await readerApi.account.getUser(reader.userId);

    expect(status).toBe(HttpStatus.OK);
    await expectSchema(body, 'bookstore/account');
  });
});
