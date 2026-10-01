import { test, expect } from '../fixtures/api.fixture';
import {
  createBooking,
  deleteBooking,
  getBooking,
  getBookingIds,
  patchBooking,
  updateBooking,
  withAuthRetry,
} from '../helpers/bookingApi';
import { buildBooking, BookingPayload } from '../test-data/bookingFactory';
import { HttpStatus } from '../test-data/httpStatus';

// Stage 2 "topics to learn" that are not separate practice-task bullets:
// expired token + retry, special characters/encoding, response time, nested
// JSON, plus PATCH. Kept in their own file so the core 5–8 practice tests in
// the other spec files stay focused on the required bullets.
test.describe('Booking edge cases', () => {
  let bookingId: number;
  let seedBooking: BookingPayload;

  test.beforeEach(async ({ request }) => {
    seedBooking = buildBooking();
    const { body } = await createBooking(request, seedBooking);
    bookingId = body.bookingid;
  });

  test.afterEach(async ({ request, authToken }) => {
    await deleteBooking(request, bookingId, authToken);
  });

  test('PUT with an expired token is rejected, then succeeds after re-authenticating and retrying once', async ({
    request,
  }) => {
    // Restful Booker tokens never expire on their own during a test run, so an
    // expired token is simulated with a value the server has never issued.
    const expiredToken = 'expired-token-0000';
    const updatedBooking = buildBooking({ firstname: 'Retried' });

    const result = await withAuthRetry(request, expiredToken, (token) =>
      updateBooking(request, bookingId, updatedBooking, token),
    );

    expect(result.retried).toBe(true);
    expect(result.token).not.toBe(expiredToken);
    expect(result.status).toBe(HttpStatus.OK);

    const { body } = await getBooking(request, bookingId);
    expect(body.firstname).toBe(updatedBooking.firstname);
  });

  test('PATCH /booking/{id} changes only the sent field and leaves the rest untouched', async ({
    request,
    authToken,
  }) => {
    const patchResult = await patchBooking(request, bookingId, { lastname: 'Patched' }, authToken);
    expect(patchResult.status).toBe(HttpStatus.OK);

    const { body } = await getBooking(request, bookingId);
    expect(body.lastname).toBe('Patched');
    // The whole point of PATCH vs PUT: untouched fields keep their old values.
    expect(body.firstname).toBe(seedBooking.firstname);
    expect(body.totalprice).toBe(seedBooking.totalprice);
  });

  test('nested bookingdates fields are read safely, and a missing nested field resolves to undefined instead of crashing', async ({
    request,
  }) => {
    const { body } = await getBooking(request, bookingId);

    const checkin: unknown = body?.bookingdates?.checkin;
    const checkout: unknown = body?.bookingdates?.checkout;
    expect(typeof checkin === 'string' && checkin === seedBooking.bookingdates.checkin).toBe(true);
    expect(typeof checkout === 'string' && checkout === seedBooking.bookingdates.checkout).toBe(true);

    // A field the API never returns: direct access (body.bookingdates.extra.value)
    // would throw a TypeError; optional chaining yields undefined instead.
    const missingNested: unknown = body?.bookingdates?.extra?.value;
    expect(missingNested === undefined).toBe(true);
  });
});

test.describe('Booking input encoding', () => {
  test('special characters in a name survive the round trip and can be used in an encoded query param', async ({
    request,
    authToken,
  }) => {
    const specialName = `Олена O'Brien & Co #${Date.now()}`;
    const { body: created } = await createBooking(request, buildBooking({ firstname: specialName }));
    const bookingId: number = created.bookingid;

    try {
      const { body } = await getBooking(request, bookingId);
      expect(body.firstname).toBe(specialName);

      // Without encodeURIComponent, "&" would end the param and "#" would start
      // a URL fragment, so the server would receive a truncated name.
      const { status, body: ids } = await getBookingIds(
        request,
        `?firstname=${encodeURIComponent(specialName)}`,
      );
      expect(status).toBe(HttpStatus.OK);
      const found = ids.some((entry: { bookingid?: unknown }) => entry?.bookingid === bookingId);
      expect(found).toBe(true);
    } finally {
      await deleteBooking(request, bookingId, authToken);
    }
  });
});

test.describe('Booking response time', () => {
  // An observation with a generous ceiling, not a performance test: it only
  // catches "something is badly wrong" (e.g. a hung request), since Restful
  // Booker is a free shared Heroku app whose latency varies run to run.
  const RESPONSE_TIME_BUDGET_MS = 5000;

  test(`GET /booking responds within ${RESPONSE_TIME_BUDGET_MS} ms`, async ({ request }) => {
    const startedAt = Date.now();
    const response = await request.get('/booking');
    const elapsedMs = Date.now() - startedAt;

    console.log(`GET /booking took ${elapsedMs} ms`);

    expect(response.status()).toBe(HttpStatus.OK);
    expect(elapsedMs).toBeLessThan(RESPONSE_TIME_BUDGET_MS);
  });
});
