import { test, expect, BookStoreApi } from '../../fixtures/bookstore.fixture';
import { expectBookStoreError } from '../../assertions/bookstore/errorAssertions';
import { UNKNOWN_ISBN } from '../../test-data/bookstore/constants';
import { HttpStatus } from '../../test-data/httpStatus';

// Negative tests for ONE endpoint, POST /BookStore/v1/Books (add books to a collection),
// in five categories. A correct "no" is 400 (401 for a missing login) with a JSON body
// { code, message }, and the collection does not change. Where DemoQA answers differently,
// the test still expects the correct answer and is marked test.fail - see assertion-notes.txt.

async function isbnsOf(api: BookStoreApi, userId: string) {
  const { status, body } = await api.account.getUser(userId);
  expect(status, 'GET /Account/v1/User/{userId}').toBe(HttpStatus.OK);
  return body.books.map((book) => book.isbn);
}

test.describe('POST /BookStore/v1/Books - 1. missing fields', () => {
  // known deviation: DemoQA answers 500 with an HTML error page
  test.fail('without userId the request is rejected with 400', async ({ readerApi, catalog }) => {
    const response = await readerApi.books.addBooksRaw({ collectionOfIsbns: [{ isbn: catalog[0].isbn }] });

    await expectBookStoreError(response, { status: HttpStatus.BAD_REQUEST });
  });

  // known deviation: DemoQA answers 500 with an HTML error page
  test.fail('without collectionOfIsbns the request is rejected with 400', async ({ reader, readerApi }) => {
    const response = await readerApi.books.addBooksRaw({ userId: reader.userId });

    await expectBookStoreError(response, { status: HttpStatus.BAD_REQUEST });
  });

  test('an empty list of books is rejected', async ({ reader, readerApi }) => {
    const response = await readerApi.books.addBooks(reader.userId, []);

    await expectBookStoreError(response, {
      status: HttpStatus.BAD_REQUEST,
      code: '1207',
      message: 'Collection of books required.',
    });
  });

  test('a book in the list without an isbn is rejected', async ({ reader, readerApi }) => {
    const response = await readerApi.books.addBooksRaw({ userId: reader.userId, collectionOfIsbns: [{}] });

    await expectBookStoreError(response, { status: HttpStatus.BAD_REQUEST, code: '1205' });
    expect(await isbnsOf(readerApi, reader.userId)).toEqual([]);
  });
});

test.describe('POST /BookStore/v1/Books - 2. invalid format', () => {
  // known deviation: DemoQA answers 401 code 1207 "User Id not correct!" - a format error is not a login error
  test.fail('a userId that is not a GUID is rejected with 400', async ({ readerApi, catalog }) => {
    const response = await readerApi.books.addBooks('not-a-guid', [catalog[0].isbn]);

    await expectBookStoreError(response, { status: HttpStatus.BAD_REQUEST });
  });

  test('an isbn sent as a number is rejected', async ({ reader, readerApi }) => {
    const response = await readerApi.books.addBooksRaw({
      userId: reader.userId,
      collectionOfIsbns: [{ isbn: 9781449325862 }],
    });

    await expectBookStoreError(response, { status: HttpStatus.BAD_REQUEST, code: '1205' });
    expect(await isbnsOf(readerApi, reader.userId)).toEqual([]);
  });

  // known deviation: DemoQA answers 500 with an HTML error page (".map is not a function")
  test.fail('collectionOfIsbns sent as a string is rejected with 400', async ({ reader, readerApi }) => {
    const response = await readerApi.books.addBooksRaw({ userId: reader.userId, collectionOfIsbns: 'abc' });

    await expectBookStoreError(response, { status: HttpStatus.BAD_REQUEST });
  });

  // known deviation: the status is right (400), but the body is an HTML page, not { code, message }
  test.fail('a body that is not valid JSON is rejected with a normal error answer', async ({ reader, readerApi }) => {
    const brokenJson = Buffer.from(`{"userId":"${reader.userId}",`); // cut off after the first field
    const response = await readerApi.books.addBooksRaw(brokenJson);

    await expectBookStoreError(response, { status: HttpStatus.BAD_REQUEST });
  });
});

test.describe('POST /BookStore/v1/Books - 3. unauthorized access', () => {
  // another reader's token on this reader's collection: businessRules.spec.ts
  test('without a token nothing is added', async ({ reader, readerApi, bookstore, catalog }) => {
    const response = await bookstore.books.addBooks(reader.userId, [catalog[0].isbn]);

    await expectBookStoreError(response, {
      status: HttpStatus.UNAUTHORIZED,
      code: '1200',
      message: 'User not authorized!',
    });
    expect(await isbnsOf(readerApi, reader.userId)).toEqual([]);
  });

  test('with a token that is not a real one nothing is added', async ({ reader, readerApi, bookstore, catalog }) => {
    const response = await bookstore.books.addBooks(reader.userId, [catalog[0].isbn], 'not-a-real-token');

    await expectBookStoreError(response, {
      status: HttpStatus.UNAUTHORIZED,
      code: '1200',
      message: 'User not authorized!',
    });
    expect(await isbnsOf(readerApi, reader.userId)).toEqual([]);
  });
});

test.describe('POST /BookStore/v1/Books - 4. business rule violations', () => {
  test('only books from the catalog can be added', async ({ reader, readerApi }) => {
    const response = await readerApi.books.addBooks(reader.userId, [UNKNOWN_ISBN]);

    await expectBookStoreError(response, {
      status: HttpStatus.BAD_REQUEST,
      code: '1205',
      message: 'ISBN supplied is not available in Books Collection!',
    });
    expect(await isbnsOf(readerApi, reader.userId)).toEqual([]);
  });

  test('an empty isbn is not a book from the catalog', async ({ reader, readerApi }) => {
    const response = await readerApi.books.addBooks(reader.userId, ['']);

    await expectBookStoreError(response, { status: HttpStatus.BAD_REQUEST, code: '1205' });
    expect(await isbnsOf(readerApi, reader.userId)).toEqual([]);
  });

  // known deviation: 201, the answer lists the book twice; the collection gets it once
  test.fail('the same book twice in one request is rejected', async ({ reader, readerApi, catalog }) => {
    const { isbn } = catalog[0];

    const response = await readerApi.books.addBooks(reader.userId, [isbn, isbn]);

    await expectBookStoreError(response, { status: HttpStatus.BAD_REQUEST, code: '1210' });
  });
});

test.describe('POST /BookStore/v1/Books - 5. duplicate data', () => {
  test('a book can be in a collection only once', async ({ reader, readerApi, catalog }) => {
    const { isbn } = catalog[0];
    const { status: firstStatus } = await readerApi.books.addBooks(reader.userId, [isbn]);
    expect(firstStatus, 'precondition: the first add works').toBe(HttpStatus.CREATED);

    const response = await readerApi.books.addBooks(reader.userId, [isbn]);

    // DemoQA uses 400 for a conflict; 409 would be the usual code
    await expectBookStoreError(response, {
      status: HttpStatus.BAD_REQUEST,
      code: '1210',
      message: "ISBN already present in the User's Collection!",
    });
    expect(await isbnsOf(readerApi, reader.userId)).toEqual([isbn]);
  });

  // known deviation: with 2+ books the 1210 check is skipped - 201, and the answer lists
  // both books as added although nothing changed
  test.fail('a list of books the reader already has is rejected, too', async ({ reader, readerApi, catalog }) => {
    const isbns = [catalog[0].isbn, catalog[1].isbn];
    const { status: firstStatus } = await readerApi.books.addBooks(reader.userId, isbns);
    expect(firstStatus, 'precondition: both books added').toBe(HttpStatus.CREATED);

    const response = await readerApi.books.addBooks(reader.userId, isbns);

    await expectBookStoreError(response, { status: HttpStatus.BAD_REQUEST, code: '1210' });
  });
});
