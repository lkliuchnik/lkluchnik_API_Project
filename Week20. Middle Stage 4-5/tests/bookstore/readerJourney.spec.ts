import { test, expect } from '../../fixtures/bookstore.fixture';
import { buildCredentials } from '../../test-data/bookstore/accountFactory';
import { HttpStatus } from '../../test-data/httpStatus';

// Middle Stage 3: one multi-step flow across related resources - an account, its token, the
// catalog, the reader's collection. Every step uses data from the steps before it.
// The test opens the account itself (it is the first step of the flow); accountCleanup closes
// it if the test stops half-way.
test('a reader opens an account, builds and changes a collection, then closes the account', async ({
  bookstore,
  catalog,
  accountCleanup,
}) => {
  const credentials = buildCredentials();
  const [first, second, third] = catalog;
  let userId = '';
  let token = '';

  await test.step('1. Open an account - the collection starts empty', async () => {
    const { status, body } = await bookstore.account.create(credentials);
    expect(status).toBe(HttpStatus.CREATED);
    userId = body.userID;
    accountCleanup.remember({ ...credentials, userId }); // closed after the test, even if a check fails
    expect(body.username).toBe(credentials.userName);
    expect(body.books).toEqual([]);
  });

  await test.step('2. Log in - the account gets a token and counts as authorized', async () => {
    const { status, body } = await bookstore.account.generateToken(credentials);
    expect(status).toBe(HttpStatus.OK);
    expect(body.status).toBe('Success');
    token = body.token!;

    const { body: authorized } = await bookstore.account.isAuthorized(credentials);
    expect(authorized).toBe(true);
  });

  await test.step('3. Add two books from the catalog', async () => {
    const { status, body } = await bookstore.books.addBooks(userId, [first.isbn, second.isbn], token);
    expect(status).toBe(HttpStatus.CREATED);
    expect(body.books).toEqual([{ isbn: first.isbn }, { isbn: second.isbn }]);
  });

  await test.step('4. The account shows both books, with the same details as the catalog', async () => {
    const { status, body } = await bookstore.account.getUser(userId, token);
    expect(status).toBe(HttpStatus.OK);
    expect(body.books).toEqual([first, second]);
  });

  await test.step('5. Replace the first book with a third one', async () => {
    const { status, body } = await bookstore.books.replaceBook(userId, first.isbn, third.isbn, token);
    expect(status).toBe(HttpStatus.OK);
    expect(body.books.map((book) => book.isbn).sort()).toEqual([second.isbn, third.isbn].sort());
  });

  await test.step('6. Delete the second book', async () => {
    const { status } = await bookstore.books.deleteBook(userId, second.isbn, token);
    expect(status).toBe(HttpStatus.NO_CONTENT);
  });

  await test.step('7. Only the third book is left', async () => {
    const { body } = await bookstore.account.getUser(userId, token);
    expect(body.books).toEqual([third]);
  });

  await test.step('8. Close the account', async () => {
    const { status } = await bookstore.account.delete(userId, token);
    expect(status).toBe(HttpStatus.NO_CONTENT);
    accountCleanup.forget(userId); // closed by the test - nothing left to clean up
  });

  await test.step('9. A closed account can neither log in nor be read', async () => {
    const { body: login } = await bookstore.account.generateToken(credentials);
    expect(login.status).toBe('Failed');
    expect(login.token).toBeNull();

    const { status, body } = await bookstore.account.getUser(userId, token);
    expect(status).toBe(HttpStatus.UNAUTHORIZED);
    expect(body.message).toBe('User not found!');
  });
});
