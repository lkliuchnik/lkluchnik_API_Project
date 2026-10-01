import { test, expect } from '../fixtures/api.fixture';
import {
  createBooking,
  deleteBooking,
  getBooking,
  getBookingIds,
  patchBooking,
  updateBookingWithRetry,
} from '../helpers/bookingApi';
import { buildBooking, BookingPayload } from '../test-data/bookingFactory';
import { HttpStatus } from '../test-data/httpStatus';

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

  test('PUT with an expired token: get a new token and retry once', async ({ request }) => {
    const expiredToken = 'expired-token-0000'; // the server never issued this token
    const updatedBooking = buildBooking({ firstname: 'Retried' });

    const result = await updateBookingWithRetry(request, bookingId, updatedBooking, expiredToken);

    expect(result.retried).toBe(true);
    expect(result.status).toBe(HttpStatus.OK);

    const { body } = await getBooking(request, bookingId);
    expect(body.firstname).toBe('Retried');
  });

  test('PATCH /booking/{id} changes only the sent field', async ({ request, authToken }) => {
    const patchResult = await patchBooking(request, bookingId, { lastname: 'Patched' }, authToken);
    expect(patchResult.status).toBe(HttpStatus.OK);

    const { body } = await getBooking(request, bookingId);
    expect(body.lastname).toBe('Patched');
    // fields that were not sent keep their old values
    expect(body.firstname).toBe(seedBooking.firstname);
    expect(body.totalprice).toBe(seedBooking.totalprice);
  });

  test('nested bookingdates fields are read safely', async ({ request }) => {
    const { body } = await getBooking(request, bookingId);

    expect(typeof body?.bookingdates?.checkin).toBe('string');
    expect(body?.bookingdates?.checkin).toBe(seedBooking.bookingdates.checkin);
    expect(body?.bookingdates?.checkout).toBe(seedBooking.bookingdates.checkout);

    // this field does not exist - ?. returns undefined instead of crashing
    expect(body?.bookingdates?.extra?.value).toBeUndefined();
  });
});

test.describe('Booking input encoding', () => {
  let createdId: number;

  test.afterEach(async ({ request, authToken }) => {
    await deleteBooking(request, createdId, authToken);
  });

  test('special characters in a name are saved and found with an encoded query', async ({ request }) => {
    const specialName = `Олена O'Brien & Co #${Date.now()}`;
    const { body: created } = await createBooking(request, buildBooking({ firstname: specialName }));
    createdId = created.bookingid;

    const { body } = await getBooking(request, createdId);
    expect(body.firstname).toBe(specialName);

    const { status, body: ids } = await getBookingIds(request, `?firstname=${encodeURIComponent(specialName)}`);
    expect(status).toBe(HttpStatus.OK);

    const found = ids.some((entry: { bookingid?: number }) => entry.bookingid === createdId);
    expect(found).toBe(true);
  });
});

test.describe('Booking response time', () => {
  const MAX_RESPONSE_TIME_MS = 5000;

  test(`GET /booking responds in less than ${MAX_RESPONSE_TIME_MS} ms`, async ({ request }) => {
    const startTime = Date.now();
    const response = await request.get('/booking');
    const responseTime = Date.now() - startTime;

    console.log(`GET /booking took ${responseTime} ms`);

    expect(response.status()).toBe(HttpStatus.OK);
    expect(responseTime).toBeLessThan(MAX_RESPONSE_TIME_MS);
  });
});
