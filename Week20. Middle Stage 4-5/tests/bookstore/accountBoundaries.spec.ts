import { test, expect } from '../../fixtures/bookstore.fixture';
import { expectBookStoreError } from '../../assertions/bookstore/errorAssertions';
import { BookStoreSession } from '../../services/bookstore/BookStoreSession';
import { buildCredentials } from '../../test-data/bookstore/accountFactory';
import { HttpStatus } from '../../test-data/httpStatus';
import { Tag } from '../../config/tags';

// Boundary value analysis for a new DemoQA account (POST /Account/v1/User).
// Every account a test opens is closed by the accountCleanup hook - if it cannot get a token,
// with the user name and password.

// A password of exactly this length that meets the other rules
// (upper and lower case letter, digit, special character).
function passwordOfLength(length: number) {
  return 'Qa!1' + 'z'.repeat(length - 4);
}

test.describe('Boundaries: password length', { tag: Tag.REGRESSION }, () => {
  test('below the minimum: 7 characters are rejected', async ({ bookstore, accountCleanup }) => {
    const credentials = buildCredentials({ password: passwordOfLength(7) });

    const response = await bookstore.account.create(credentials);

    // if DemoQA ever accepts it, the account must still be closed after the test
    if (response.status === HttpStatus.CREATED) accountCleanup.remember({ ...credentials, userId: response.body.userID });
    await expectBookStoreError(response, { status: HttpStatus.BAD_REQUEST, code: '1300' });
  });

  // also the DemoQA smoke test: opening and closing one account is the shortest happy path
  // of DemoQA (3 requests) - a smoke test must stay fast even when DemoQA is slow
  test('the minimum: 8 characters are accepted', { tag: Tag.SMOKE }, async ({ bookstore, accountCleanup }) => {
    const credentials = buildCredentials({ password: passwordOfLength(8) });

    const { status, body } = await bookstore.account.create(credentials);

    expect(status).toBe(HttpStatus.CREATED);
    accountCleanup.remember({ ...credentials, userId: body.userID });
  });
});

// The user name and the password go into the token in plain text, and the token must fit
// into 255 characters: user name + password = 84 characters is the longest that works.
// The two fields share one limit, so it is crossed from either side.
const MAX_NAME_AND_PASSWORD = 84;

test.describe('Boundaries: user name + password length (login token)', { tag: Tag.REGRESSION }, () => {
  test(`the maximum: ${MAX_NAME_AND_PASSWORD} characters together can log in`, async ({
    bookstore,
    accountCleanup,
  }) => {
    const { userName } = buildCredentials();
    const credentials = { userName, password: passwordOfLength(MAX_NAME_AND_PASSWORD - userName.length) };
    const { status, body } = await bookstore.account.create(credentials);
    expect(status, 'precondition: POST /Account/v1/User').toBe(HttpStatus.CREATED);
    // the same session for the test and the cleanup: one login only (a second one fails, see assertion-notes.txt)
    const session = new BookStoreSession(bookstore.account, credentials);
    accountCleanup.remember({ ...credentials, userId: body.userID }, session);

    const token = await session.getToken();

    expect(token).toHaveLength(255);
    const { status: readStatus } = await bookstore.account.getUser(body.userID, token);
    expect(readStatus).toBe(HttpStatus.OK);
  });

  // known deviation: the account is created (201), but GenerateToken answers 500 - it can never log in.
  // The rule holds for both correct designs: refused at creation with 400, or created and able to log in.
  test.fail(`above the maximum: ${MAX_NAME_AND_PASSWORD + 1} characters are refused, or the account can log in`, async ({
    bookstore,
    accountCleanup,
  }) => {
    const { userName } = buildCredentials();
    const credentials = { userName, password: passwordOfLength(MAX_NAME_AND_PASSWORD + 1 - userName.length) };
    const response = await bookstore.account.create(credentials);
    if (response.status !== HttpStatus.CREATED) {
      // a correct design too: a too-long account is refused as a client error, not left half-made
      await expectBookStoreError(response, { status: HttpStatus.BAD_REQUEST });
      return;
    }
    accountCleanup.remember({ ...credentials, userId: response.body.userID });

    const { status: tokenStatus, body: tokenAnswer } = await bookstore.account.generateToken(credentials);

    expect(tokenStatus).toBe(HttpStatus.OK);
    expect(tokenAnswer.status).toBe('Success');
  });
});
