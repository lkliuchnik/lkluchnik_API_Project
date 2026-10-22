import { test, expect } from '../../fixtures/bookstore.fixture';
import { HttpStatus } from '../../test-data/httpStatus';

// Scenarios from the coverage gap analysis (helpers/coverage-gaps.txt): changing a whole
// collection at once.
test.describe('Collection changes', () => {
  // gaps S7 + S6
  test('the owner can empty the whole collection; without the owner token nobody can', async ({
    reader,
    readerApi,
    newReader,
    bookstore,
    catalog,
  }) => {
    const [first, second] = catalog;
    const { status: addStatus } = await readerApi.books.addBooks(reader.userId, [first.isbn, second.isbn]);
    expect(addStatus, 'precondition: two books added').toBe(HttpStatus.CREATED);

    // without a token, and with another reader's token: rejected, nothing changes
    const other = await newReader();
    const otherToken = await other.session.getToken();
    const { status: noTokenStatus } = await bookstore.books.deleteAllBooks(reader.userId);
    const { status: otherStatus } = await bookstore.books.deleteAllBooks(reader.userId, otherToken);
    const { status: otherDeletesAccount } = await bookstore.account.delete(reader.userId, otherToken);
    expect(noTokenStatus).toBe(HttpStatus.UNAUTHORIZED);
    expect(otherStatus).toBe(HttpStatus.UNAUTHORIZED);
    expect(otherDeletesAccount).toBe(HttpStatus.UNAUTHORIZED);
    const { body: unchanged } = await readerApi.account.getUser(reader.userId);
    expect(unchanged.books.map((book) => book.isbn)).toEqual([first.isbn, second.isbn]);

    // the owner: the collection is empty afterwards
    const { status } = await readerApi.books.deleteAllBooks(reader.userId);
    expect(status).toBe(HttpStatus.NO_CONTENT);
    const { body: emptied } = await readerApi.account.getUser(reader.userId);
    expect(emptied.books).toEqual([]);
  });

  // gap S8 (a list with an unknown ISBN) is in bulkAdd.spec.ts, with the other partial failure tests
});
