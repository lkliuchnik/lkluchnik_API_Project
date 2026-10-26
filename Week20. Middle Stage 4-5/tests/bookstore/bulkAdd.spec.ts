import { test, expect, BookStoreApi } from '../../fixtures/bookstore.fixture';
import { expectBookStoreError } from '../../assertions/bookstore/errorAssertions';
import { UNKNOWN_ISBN } from '../../test-data/bookstore/constants';
import { HttpStatus } from '../../test-data/httpStatus';
import { Tag } from '../../config/tags';

// Partial failures in a bulk operation: POST /BookStore/v1/Books adds a LIST of books in one
// request. What a correct bulk API may do with a list that has bad items in it:
//   - all or nothing: an error, and nothing is added, or
//   - partial success: the good items are added, and the answer says exactly which ones.
// DemoQA chose partial success: the good books are added, the bad ones are dropped without
// a word, and the answer simply repeats the list that was sent. The tests check every item
// on the server, not only the answer. Contrast: PetStore createWithArray (bulkUsers.spec.ts).

async function isbnsOf(api: BookStoreApi, userId: string) {
  const { status, body } = await api.account.getUser(userId);
  expect(status, 'GET /Account/v1/User/{userId}').toBe(HttpStatus.OK);
  return body.books.map((book) => book.isbn);
}

test.describe('Bulk add: one unknown ISBN in a list of books', { tag: Tag.REGRESSION }, () => {
  // the position of the bad item must not matter: first, in the middle, last
  const positions = [
    { title: 'first', list: (good: string[]) => [UNKNOWN_ISBN, ...good] },
    { title: 'in the middle', list: (good: string[]) => [good[0], UNKNOWN_ISBN, good[1]] },
    { title: 'last', list: (good: string[]) => [...good, UNKNOWN_ISBN] },
  ];

  for (const position of positions) {
    test(`unknown ISBN ${position.title}: every catalog book is added, the unknown one is not`, async ({
      reader,
      readerApi,
      catalog,
    }) => {
      const good = [catalog[0].isbn, catalog[1].isbn];

      const { status } = await readerApi.books.addBooks(reader.userId, position.list(good));

      expect(status).toBe(HttpStatus.CREATED);
      const collection = await isbnsOf(readerApi, reader.userId);
      expect(collection).toEqual(good);
      expect(collection).not.toContain(UNKNOWN_ISBN);
    });
  }

  // gap S8. known deviation: the answer repeats the whole list, the unknown ISBN included.
  // The rule holds for both correct designs: an error answer lists no books and nothing is
  // added; a success answer lists exactly the books that were added.
  test.fail('the answer lists only the books that were really added', async ({ reader, readerApi, catalog }) => {
    const good = catalog[0].isbn;

    const { body } = await readerApi.books.addBooks(reader.userId, [good, UNKNOWN_ISBN]);

    const answered = body.books?.map((book) => book.isbn) ?? [];
    const added = await isbnsOf(readerApi, reader.userId);
    expect(answered, 'the answer = what is in the collection now').toEqual(added);
  });

  test('the books already in the collection stay when a list with a bad item comes', async ({
    reader,
    readerApi,
    catalog,
  }) => {
    const [owned, extra] = [catalog[0].isbn, catalog[1].isbn];
    const { status: firstStatus } = await readerApi.books.addBooks(reader.userId, [owned]);
    expect(firstStatus, 'precondition: one book in the collection').toBe(HttpStatus.CREATED);

    await readerApi.books.addBooks(reader.userId, [extra, UNKNOWN_ISBN]);

    expect(await isbnsOf(readerApi, reader.userId)).toEqual([owned, extra]);
  });
});

test.describe('Bulk add: no good item in the list', { tag: Tag.REGRESSION }, () => {
  // known deviation: 201 although nothing was added; a list of ONE unknown ISBN gets the
  // correct 400 code 1205 - the check runs only for one-book requests
  test.fail('a list of unknown ISBNs only is rejected like a single one', async ({ reader, readerApi }) => {
    const response = await readerApi.books.addBooks(reader.userId, [UNKNOWN_ISBN, '1111111111']);

    await expectBookStoreError(response, { status: HttpStatus.BAD_REQUEST, code: '1205' });
    expect(await isbnsOf(readerApi, reader.userId)).toEqual([]);
  });
});
