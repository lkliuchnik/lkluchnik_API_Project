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
import { setupStep } from './infrastructure';

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

export type AccountCleanup = {
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

  catalog: async ({ bookstore }, use, testInfo) => {
    const { status, body } = await setupStep(testInfo, 'GET /BookStore/v1/Books', () => bookstore.books.getCatalog());
    expect(status, 'precondition: GET /BookStore/v1/Books').toBe(HttpStatus.OK);
    expect(body.books.length, 'precondition: the catalog has at least 3 books').toBeGreaterThanOrEqual(3);
    await use(body.books);
  },

  // Shared hook: every account a test opens is closed after the test, also when the test fails
  // half-way. It reuses the reader's token; only if that token no longer works (for example
  // after a UI login) the auth interceptor gets a new one. If no token can be got at all (an
  // account made by a boundary test), the user name and password are used (Basic auth).
  // All accounts are closed at the same time; one that cannot be closed is marked in the
  // report as "leaked data" - but only after DemoQA confirms it still exists: on a slow day a
  // DELETE can work on the server while its answer comes too late, and a second DELETE of a
  // gone account gets 200 "User Id not correct!" (reports/2026-10-23-staging-demoqa-timeouts.txt).
  accountCleanup: async ({ request, env, apiLog, bookstore }, use, testInfo) => {
    const accounts = new Map<string, { account: ReaderAccount; session: BookStoreSession }>();
    await use({
      remember: (account, session = new BookStoreSession(bookstore.account, account)) => {
        accounts.set(account.userId, { account, session });
      },
      forget: (userId) => {
        accounts.delete(userId);
      },
    });

    const results = await Promise.allSettled(
      [...accounts.values()].map(async ({ account, session }) => {
        let byToken: string; // what the token way gave, for the report if both ways fail
        try {
          const { status } = await bookStoreApi(request, env, apiLog, session).account.delete(account.userId);
          if (status === HttpStatus.NO_CONTENT) return;
          byToken = `DELETE answered ${status}`;
        } catch (error) {
          byToken = (error as Error).message; // no token could be got - try the password below
        }

        let byPassword: string; // what the password way gave
        try {
          const { status } = await bookstore.account.deleteWithPassword(account.userId, account);
          if (status === HttpStatus.NO_CONTENT) return;
          byPassword = `DELETE answered ${status}`;
        } catch (error) {
          byPassword = error instanceof Error ? error.message : String(error);
        }
        const tried = `with the token: ${byToken}; with the password: ${byPassword}`;

        // Neither way gave a clear "deleted" - does the account still exist? POST
        // /Account/v1/Authorized with the account's own name and password: 200 (true or
        // false) = it exists; 404 "User not found!" = it is gone. (404 also comes for a wrong
        // password - but these are the name and password the account was created with.)
        let lookup: number;
        try {
          lookup = (await bookstore.account.isAuthorized(account)).status;
        } catch (error) {
          throw new Error(`${tried}; could not check whether it still exists: ${(error as Error).message}`);
        }
        if (lookup === HttpStatus.NOT_FOUND) {
          testInfo.annotations.push({
            type: 'cleanup note',
            description:
              `${account.userId}: no clear "deleted" (${tried}), ` + 'but the account no longer exists - not leaked',
          });
          return;
        }
        const state = lookup === HttpStatus.OK ? 'the account still exists' : `the check answered ${lookup}`;
        throw new Error(`${tried}; ${state}`);
      }),
    );
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        const userId = [...accounts.keys()][i];
        testInfo.annotations.push({ type: 'leaked data', description: `${userId}: ${result.reason}` });
      }
    });
  },

  // Seeded data that really exists on the server: new readers with empty collections.
  newReader: async ({ bookstore, accountCleanup }, use, testInfo) => {
    await use(async () => {
      const credentials = buildCredentials();
      const { status, body } = await setupStep(testInfo, 'POST /Account/v1/User', () =>
        bookstore.account.create(credentials),
      );
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
