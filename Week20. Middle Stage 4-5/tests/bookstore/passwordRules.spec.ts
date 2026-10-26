import { test, expect, AccountCleanup, BookStoreApi } from '../../fixtures/bookstore.fixture';
import { expectBookStoreError } from '../../assertions/bookstore/errorAssertions';
import { buildCredentials } from '../../test-data/bookstore/accountFactory';
import { LOGIN_DATA_MISSING_MESSAGE, PASSWORD_TOO_WEAK_MESSAGE } from '../../test-data/bookstore/constants';
import { HttpStatus } from '../../test-data/httpStatus';
import { Tag } from '../../config/tags';

// Data-driven: the password rules of a new DemoQA account (POST /Account/v1/User) - one table,
// one test body. Each row is one rule in plain words, and every row becomes its own test,
// named after the rule. The table is the specification.
//
// The rule, as DemoQA states it in its error: 8 characters or more, with an upper case letter
// A-Z, a lower case letter a-z, a digit 0-9 and a special character. In practice DemoQA counts
// only these 8 as special: ! @ # $ % ^ & *  (checked live with 31 characters, 26 October 2026).
//
//   accepted            the account is created and can log in with this password
//   refused: too weak   400, code 1300, DemoQA's "Passwords must have ..." message
//   refused: missing    400, code 1200, "UserName and Password required."
//
// Every account a row creates is closed after the test.

type Expected = 'accepted' | 'refused: too weak' | 'refused: missing';

interface PasswordRule {
  rule: string; // what the row shows, in plain words - also the test title
  password: string;
  expected: Expected;
}

const passwordRules: PasswordRule[] = [
  { rule: 'the shortest strong password: 8 characters of all four kinds', password: 'Test!123', expected: 'accepted' },
  { rule: 'a long strong password (20 characters)', password: 'Test!1234567890abcde', expected: 'accepted' },
  { rule: 'another of the 8 special characters: *', password: 'Test*123', expected: 'accepted' },
  { rule: 'too short: 7 characters', password: 'Test!12', expected: 'refused: too weak' },
  { rule: 'no upper case letter', password: 'test!123', expected: 'refused: too weak' },
  { rule: 'no lower case letter', password: 'TEST!123', expected: 'refused: too weak' },
  { rule: 'no digit', password: 'Test!abc', expected: 'refused: too weak' },
  { rule: 'no special character', password: 'Test1234', expected: 'refused: too weak' },
  { rule: 'only digits', password: '12345678', expected: 'refused: too weak' },
  {
    rule: 'a Cyrillic capital "Т" (U+0422) instead of the Latin "T" is not an upper case letter A-Z',
    password: 'Тest!123', // looks like Test!123, but the first letter is Cyrillic
    expected: 'refused: too weak',
  },
  { rule: 'no password at all', password: '', expected: 'refused: missing' },
];

// known deviation: DemoQA counts only ! @ # $ % ^ & * as special characters and refuses a dot
// with code 1300, although its own message asks for "a non alphanumeric character" (#37)
const passwordRulesDemoQABreaks: PasswordRule[] = [
  { rule: 'a dot is a special character too', password: 'Test.123', expected: 'accepted' },
];

const REFUSALS = {
  'refused: too weak': { status: HttpStatus.BAD_REQUEST, code: '1300', message: PASSWORD_TOO_WEAK_MESSAGE },
  'refused: missing': { status: HttpStatus.BAD_REQUEST, code: '1200', message: LOGIN_DATA_MISSING_MESSAGE },
} satisfies Record<Exclude<Expected, 'accepted'>, unknown>;

// 502/503/504 come from the gateway in front of DemoQA: the password never reached it, so the
// rule cannot be judged - the test is skipped with the reason, not passed or failed.
const GATEWAY_ERRORS: number[] = [HttpStatus.BAD_GATEWAY, HttpStatus.SERVICE_UNAVAILABLE, HttpStatus.GATEWAY_TIMEOUT];

const title = (row: PasswordRule) => `${row.rule}: ${JSON.stringify(row.password)}`;

// The one test body of the table.
async function checkPassword(
  row: PasswordRule,
  { bookstore, accountCleanup }: { bookstore: BookStoreApi; accountCleanup: AccountCleanup },
) {
  const credentials = buildCredentials({ password: row.password });

  const response = await bookstore.account.create(credentials);

  const gatewayError = GATEWAY_ERRORS.includes(response.status);
  test.skip(gatewayError, `infrastructure: POST /Account/v1/User answered ${response.status}`);
  // a created account is closed after the test - also one that should have been refused
  if (response.status === HttpStatus.CREATED) accountCleanup.remember({ ...credentials, userId: response.body.userID });

  if (row.expected === 'accepted') {
    expect(response.status, 'the account is created').toBe(HttpStatus.CREATED);
    const { body: login } = await bookstore.account.generateToken(credentials);
    expect(login.status, 'and it can log in with this password').toBe('Success');
  } else {
    await expectBookStoreError(response, REFUSALS[row.expected]);
  }
}

test.describe('Password rules of a new DemoQA account', { tag: Tag.REGRESSION }, () => {
  for (const row of passwordRules) {
    test(title(row), async ({ bookstore, accountCleanup }) => checkPassword(row, { bookstore, accountCleanup }));
  }

  for (const row of passwordRulesDemoQABreaks) {
    test.fail(title(row), async ({ bookstore, accountCleanup }) => checkPassword(row, { bookstore, accountCleanup }));
  }
});
