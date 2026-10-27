import { test, expect, BookStoreApi, Reader } from '../../fixtures/bookstore.fixture';
import { expectBookStoreError } from '../../assertions/bookstore/errorAssertions';
import { ApiResponse } from '../../models/common';
import { Credentials } from '../../models/bookstore/account';
import { Book } from '../../models/bookstore/book';
import { buildCredentials } from '../../test-data/bookstore/accountFactory';
import {
  LOGIN_DATA_MISSING_MESSAGE,
  PASSWORD_TOO_WEAK_MESSAGE,
  UNKNOWN_ISBN,
} from '../../test-data/bookstore/constants';
import { HttpStatus } from '../../test-data/httpStatus';
import { Tag } from '../../config/tags';

// Error consistency: every DemoQA endpoint answers an error the same way - a JSON body of
// exactly { code, message } with a DemoQA error code (expectBookStoreError). Different
// endpoints of the account and the book store, different reasons, one shape.
// Where DemoQA answers differently, the case is marked test.fail - see assertion-notes.txt.

type ErrorCase = {
  title: string; // endpoint - what is wrong with the request
  status: number;
  code: string;
  message: string;
};

// requests that need no account. "opens" = the login data of a request that would open an
// account if DemoQA accepted it by mistake - the test then closes that account.
const EMPTY_LOGIN: Credentials = { userName: '', password: '' };
const WEAK_PASSWORD = buildCredentials({ password: 'weak' });
const withoutAccount: (ErrorCase & {
  send: (api: BookStoreApi) => Promise<ApiResponse<unknown>>;
  opens?: Credentials;
})[] = [
  {
    title: 'GET /BookStore/v1/Book - unknown ISBN',
    send: (api) => api.books.getBook(UNKNOWN_ISBN),
    status: HttpStatus.BAD_REQUEST,
    code: '1205',
    message: 'ISBN supplied is not available in Books Collection!',
  },
  {
    title: 'POST /Account/v1/User - empty user name and password',
    send: (api) => api.account.create(EMPTY_LOGIN),
    opens: EMPTY_LOGIN,
    status: HttpStatus.BAD_REQUEST,
    code: '1200',
    message: LOGIN_DATA_MISSING_MESSAGE,
  },
  {
    title: 'POST /Account/v1/User - weak password',
    send: (api) => api.account.create(WEAK_PASSWORD),
    opens: WEAK_PASSWORD,
    status: HttpStatus.BAD_REQUEST,
    code: '1300',
    message: PASSWORD_TOO_WEAK_MESSAGE,
  },
  {
    title: 'POST /Account/v1/Authorized - unknown user',
    send: (api) => api.account.isAuthorized(buildCredentials()),
    status: HttpStatus.NOT_FOUND,
    code: '1207',
    message: 'User not found!',
  },
];

// requests about a real reader (a new account from the fixture)
type ReaderContext = { bookstore: BookStoreApi; readerApi: BookStoreApi; reader: Reader; catalog: Book[] };
const withReader: (ErrorCase & { send: (c: ReaderContext) => Promise<ApiResponse<unknown>> })[] = [
  {
    title: 'POST /BookStore/v1/Books - unknown ISBN',
    send: ({ readerApi, reader }) => readerApi.books.addBooks(reader.userId, [UNKNOWN_ISBN]),
    status: HttpStatus.BAD_REQUEST,
    code: '1205',
    message: 'ISBN supplied is not available in Books Collection!',
  },
  {
    title: 'PUT /BookStore/v1/Books/{isbn} - book not in the collection',
    send: ({ readerApi, reader, catalog }) => readerApi.books.replaceBook(reader.userId, catalog[0].isbn, catalog[1].isbn),
    status: HttpStatus.BAD_REQUEST,
    code: '1206',
    message: "ISBN supplied is not available in User's Collection!",
  },
  {
    title: 'DELETE /BookStore/v1/Book - book not in the collection',
    send: ({ readerApi, reader, catalog }) => readerApi.books.deleteBook(reader.userId, catalog[0].isbn),
    status: HttpStatus.BAD_REQUEST,
    code: '1206',
    message: "ISBN supplied is not available in User's Collection!",
  },
  {
    title: 'GET /Account/v1/User/{userId} - no token',
    send: ({ bookstore, reader }) => bookstore.account.getUser(reader.userId),
    status: HttpStatus.UNAUTHORIZED,
    code: '1200',
    message: 'User not authorized!',
  },
  {
    title: 'POST /Account/v1/User - user name already taken',
    send: ({ bookstore, reader }) => bookstore.account.create(reader),
    status: HttpStatus.NOT_ACCEPTABLE,
    code: '1204',
    message: 'User exists!',
  },
];

test.describe('DemoQA errors have one shape on every endpoint', { tag: Tag.REGRESSION }, () => {
  for (const c of withoutAccount) {
    test(`${c.title}: ${c.status} code ${c.code}`, async ({ bookstore, accountCleanup }) => {
      const response = await c.send(bookstore);

      // if DemoQA ever accepts the new account, it must still be closed after the test
      const created = response.body as { userID?: string };
      if (c.opens && response.status === HttpStatus.CREATED && created.userID) {
        accountCleanup.remember({ ...c.opens, userId: created.userID });
      }
      await expectBookStoreError(response, { status: c.status, code: c.code, message: c.message });
    });
  }

  for (const c of withReader) {
    test(`${c.title}: ${c.status} code ${c.code}`, async ({ bookstore, readerApi, reader, catalog }) => {
      const response = await c.send({ bookstore, readerApi, reader, catalog });

      await expectBookStoreError(response, { status: c.status, code: c.code, message: c.message });
    });
  }

  // known deviation: a failed login is not an error answer - 200 with
  // { token: null, status: "Failed", result: "User authorization failed." }
  test.fail('POST /Account/v1/GenerateToken - wrong password: 401 with { code, message }', async ({
    bookstore,
    reader,
  }) => {
    const response = await bookstore.account.generateToken({ userName: reader.userName, password: 'Wrong!123x' });

    await expectBookStoreError(response, { status: HttpStatus.UNAUTHORIZED });
  });

  // known deviation: 200 with an EMPTY body
  test.fail('POST /Account/v1/Login - wrong password: 401 with { code, message }', async ({ bookstore, reader }) => {
    const response = await bookstore.account.login({ userName: reader.userName, password: 'Wrong!123x' });

    await expectBookStoreError(response, { status: HttpStatus.UNAUTHORIZED });
  });

  // known deviation: one code, several errors - 1200 is "User not authorized!" and "UserName and
  // Password required.", 1207 is "User not found!" and "Collection of books required."
  test.fail('one error code means one error on every endpoint', async ({
    bookstore,
    readerApi,
    reader,
    accountCleanup,
  }) => {
    const answers = [
      await bookstore.account.getUser(reader.userId),
      await bookstore.account.create(EMPTY_LOGIN),
      await bookstore.account.isAuthorized(buildCredentials()),
      await readerApi.books.addBooks(reader.userId, []),
    ];
    // if DemoQA ever accepts the empty login, that account must still be closed after the test
    const created = answers[1].body as { userID?: string };
    if (answers[1].status === HttpStatus.CREATED && created.userID) {
      accountCleanup.remember({ ...EMPTY_LOGIN, userId: created.userID });
    }

    // every code the answers used, with all the messages it came with
    const messagesByCode = new Map<string, Set<string>>();
    for (const { body } of answers) {
      const { code, message } = body as { code?: string; message?: string };
      if (code) messagesByCode.set(code, (messagesByCode.get(code) ?? new Set()).add(String(message)));
    }
    for (const [code, messages] of messagesByCode) {
      expect.soft(messages.size, `code ${code}: ${[...messages].join(' | ')}`).toBe(1);
    }
  });
});
