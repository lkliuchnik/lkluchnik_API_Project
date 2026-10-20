import { APIRequestContext } from '@playwright/test';
import { test as base, expect } from './base.fixture';
import { ApiClient } from '../api/ApiClient';
import { createApiClient } from '../api/createApiClient';
import { authInterceptor } from '../api/interceptors/auth';
import { Environment } from '../config/environments';
import { AccountService } from '../services/bookstore/AccountService';
import { BookStoreService } from '../services/bookstore/BookStoreService';
import { BookStoreSession } from '../services/bookstore/BookStoreSession';
import { Credentials } from '../models/bookstore/account';
import { Book } from '../models/bookstore/book';
import { buildCredentials } from '../test-data/bookstore/accountFactory';
import { HttpStatus } from '../test-data/httpStatus';

// All DemoQA BookStore services on one client. A new service is added here - one line.
function servicesFor(client: ApiClient) {
  return {
    account: new AccountService(client),
    books: new BookStoreService(client),
  };
}

export type BookStoreApi = ReturnType<typeof servicesFor>;

// A DemoQA client the standard way, with the longer DemoQA timeout. With a session, every
// request is logged in as that reader (auth interceptor).
function bookStoreApi(request: APIRequestContext, env: Environment, apiLog: string[], session?: BookStoreSession) {
  const client = createApiClient(request, {
    baseUrl: env.bookstore.baseUrl,
    http: { ...env.http, timeoutMs: env.bookstore.timeoutMs },
    log: apiLog,
    auth: session ? authInterceptor(session) : undefined,
  });
  return servicesFor(client);
}

export type ReaderAccount = Credentials & { userId: string };

// A reader together with their login session. The session keeps the token, so the test,
// readerApi and the cleanup all use ONE token (DemoQA keeps only the newest token anyway).
export type Reader = ReaderAccount & { session: BookStoreSession };

type AccountCleanup = {
  remember(account: ReaderAccount, session?: BookStoreSession): void; // close it after the test
  forget(userId: string): void; // the test closed it itself - nothing to clean up
};

type BookStoreFixtures = {
  bookstore: BookStoreApi; // services without login: a request has a token only if the test passes one
  catalog: Book[]; // the books of the store, read before the test
  accountCleanup: AccountCleanup;
  newReader: () => Promise<Reader>; // opens one more new account (closed after the test)
  reader: Reader; // a NEW account, opened before the test and closed after it
  readerApi: BookStoreApi; // services with the auth interceptor, logged in as the reader
};

export const test = base.extend<BookStoreFixtures>({
  bookstore: async ({ request, env, apiLog }, use) => {
    await use(bookStoreApi(request, env, apiLog));
  },

  catalog: async ({ bookstore }, use) => {
    const { status, body } = await bookstore.books.getCatalog();
    expect(status, 'precondition: GET /BookStore/v1/Books').toBe(HttpStatus.OK);
    expect(body.books.length, 'precondition: the catalog has at least 3 books').toBeGreaterThanOrEqual(3);
    await use(body.books);
  },

  // Shared hook: every account a test opens is closed after the test, also when the test fails
  // half-way. It reuses the reader's token; only if that token no longer works (for example
  // after a UI login) the auth interceptor gets a new one. All accounts are closed at the same
  // time; one that cannot be closed is marked in the report as "leaked account".
  accountCleanup: async ({ request, env, apiLog, bookstore }, use, testInfo) => {
    const accounts = new Map<string, BookStoreSession>();
    await use({
      remember: (account, session = new BookStoreSession(bookstore.account, account)) => {
        accounts.set(account.userId, session);
      },
      forget: (userId) => {
        accounts.delete(userId);
      },
    });

    const results = await Promise.allSettled(
      [...accounts].map(async ([userId, session]) => {
        const { status } = await bookStoreApi(request, env, apiLog, session).account.delete(userId);
        if (status !== HttpStatus.NO_CONTENT) throw new Error(`DELETE answered ${status}`);
      }),
    );
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        const userId = [...accounts.keys()][i];
        testInfo.annotations.push({ type: 'leaked account', description: `${userId}: ${result.reason}` });
      }
    });
  },

  // Seeded data that really exists on the server: new readers with empty collections.
  newReader: async ({ bookstore, accountCleanup }, use) => {
    await use(async () => {
      const credentials = buildCredentials();
      const { status, body } = await bookstore.account.create(credentials);
      expect(status, 'precondition: POST /Account/v1/User').toBe(HttpStatus.CREATED);

      const account = { ...credentials, userId: body.userID };
      const session = new BookStoreSession(bookstore.account, account);
      accountCleanup.remember(account, session);
      return { ...account, session };
    });
  },

  reader: async ({ newReader }, use) => {
    await use(await newReader());
  },

  readerApi: async ({ request, env, apiLog, reader }, use) => {
    await use(bookStoreApi(request, env, apiLog, reader.session));
  },
});

export { expect };
