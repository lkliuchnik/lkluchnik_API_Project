import { test, expect } from '../../fixtures/dummyjson.fixture';
import { HttpStatus } from '../../test-data/httpStatus';

// An asynchronous change on a real server: a token is fine now and stops working later,
// without any request from us. The test cannot know the exact second, so it asks again
// and again (polling) until the answer changes - and it has a limit, so it cannot wait forever.
// The shortest token DummyJSON gives lives 1 minute, so this test takes about a minute (@slow).

const LIFETIME_MS = 60_000;
const POLL_EVERY_MS = 5_000;

test('a 1-minute token works at first and is refused once the minute is over', { tag: '@slow' }, async ({
  api,
  env,
}) => {
  test.setTimeout(LIFETIME_MS * 2 + 30_000);
  const { status, body } = await api.auth.login(env.dummyjson.username, env.dummyjson.password, 1);
  expect(status, 'precondition: login with expiresInMins 1').toBe(HttpStatus.OK);
  const loggedInAt = Date.now();

  const { status: firstStatus } = await api.auth.getCurrentUser(body.accessToken);
  expect(firstStatus, 'right after the login the token works').toBe(HttpStatus.OK);

  await expect
    .poll(async () => (await api.auth.getCurrentUser(body.accessToken)).status, {
      message: `GET /auth/me with the token, every ${POLL_EVERY_MS / 1000} s, until it is refused`,
      intervals: [POLL_EVERY_MS],
      timeout: LIFETIME_MS * 2, // the limit: twice the lifetime, then the test fails with a clear message
    })
    .toBe(HttpStatus.UNAUTHORIZED);

  // refused for the right reason, and not before the minute was over (5 s for clock differences)
  const waitedMs = Date.now() - loggedInAt;
  expect(waitedMs, 'time from login to the first refusal').toBeGreaterThanOrEqual(LIFETIME_MS - 5_000);
  const { body: refusal } = await api.auth.getCurrentUser(body.accessToken);
  expect(refusal.message).toBe('Token Expired!');
});
