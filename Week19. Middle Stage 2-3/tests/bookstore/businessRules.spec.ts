import { test, expect } from '../../fixtures/bookstore.fixture';
import { buildCredentials } from '../../test-data/bookstore/accountFactory';
import { HttpStatus } from '../../test-data/httpStatus';

// Rules of the book store itself - not "is the field there", but "does the store keep its
// promises". Each test gets a new reader (an account that really exists) from the fixture.
test.describe('Book store business rules', () => {
  test('a book can be in a collection only once', async ({ reader, readerApi, catalog }) => {
    const book = catalog[0];
    const { status: firstStatus } = await readerApi.books.addBooks(reader.userId, [book.isbn]);
    expect(firstStatus, 'precondition: the first add works').toBe(HttpStatus.CREATED);

    const { status, body } = await readerApi.books.addBooks(reader.userId, [book.isbn]);

    expect(status).toBe(HttpStatus.BAD_REQUEST);
    expect(body.code).toBe('1210');
    expect(body.message).toBe("ISBN already present in the User's Collection!");
  });

  // known deviation: DemoQA allows the same book twice, see assertion-notes.txt
  test.fail('replacing a book with one the reader already has is rejected, too', async ({
    reader,
    readerApi,
    catalog,
  }) => {
    const [first, second] = catalog;
    const { status: addStatus } = await readerApi.books.addBooks(reader.userId, [first.isbn, second.isbn]);
    expect(addStatus, 'precondition: both books added').toBe(HttpStatus.CREATED);

    // the same rule as above, reached through another endpoint
    const { status } = await readerApi.books.replaceBook(reader.userId, first.isbn, second.isbn);

    expect(status).toBe(HttpStatus.BAD_REQUEST);
    const { body: account } = await readerApi.account.getUser(reader.userId);
    expect(account.books.map((book) => book.isbn)).toEqual([first.isbn, second.isbn]);
  });

  test('only books from the catalog can be added', async ({ reader, readerApi }) => {
    const { status, body } = await readerApi.books.addBooks(reader.userId, ['0000000000']);

    expect(status).toBe(HttpStatus.BAD_REQUEST);
    expect(body.code).toBe('1205');
    expect(body.message).toBe('ISBN supplied is not available in Books Collection!');
  });

  test('a collection belongs to its owner: another reader can neither read nor change it', async ({
    reader,
    readerApi,
    newReader,
    bookstore,
    catalog,
  }) => {
    // a second reader, logged in with their own token
    const other = await newReader();
    const otherToken = await other.session.getToken();

    // DemoQA answers 401 here (403 would be more exact) - the rule holds: no data, no change
    const { status: readStatus, body: readBody } = await bookstore.account.getUser(reader.userId, otherToken);
    expect(readStatus).toBe(HttpStatus.UNAUTHORIZED);
    expect(readBody.books).toBeUndefined();

    const { status: addStatus } = await bookstore.books.addBooks(reader.userId, [catalog[0].isbn], otherToken);
    expect(addStatus).toBe(HttpStatus.UNAUTHORIZED);

    // the owner's collection did not change
    const { status: ownerStatus, body: owner } = await readerApi.account.getUser(reader.userId);
    expect(ownerStatus).toBe(HttpStatus.OK);
    expect(owner.books).toEqual([]);
  });

  test('an account needs a strong password', async ({ bookstore }) => {
    const { status, body } = await bookstore.account.create(buildCredentials({ password: 'weak' }));

    expect(status).toBe(HttpStatus.BAD_REQUEST);
    expect(body.code).toBe('1300');
    expect(body.message).toContain('Passwords must have at least one non alphanumeric character');
  });

  test('a user name can be taken only once', async ({ reader, bookstore }) => {
    const { status, body } = await bookstore.account.create({ userName: reader.userName, password: reader.password });

    expect(status).toBe(HttpStatus.NOT_ACCEPTABLE);
    expect(body.code).toBe('1204');
    expect(body.message).toBe('User exists!');
  });
});
