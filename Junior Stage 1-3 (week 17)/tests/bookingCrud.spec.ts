import { test, expect } from '../fixtures/api.fixture';
import { createBooking, getBooking, updateBooking, deleteBooking } from '../helpers/bookingApi';
import { buildBooking, BookingPayload } from '../test-data/bookingFactory';
import { bookingSchema, createBookingResponseSchema } from '../models/booking.model';
import { HttpStatus } from '../test-data/httpStatus';

test.describe('Booking CRUD against an existing booking', () => {
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

  test('GET /booking/{id} returns status 200 and the created booking fields', async ({ request }) => {
    const { status, body } = await getBooking(request, bookingId);

    expect(status).toBe(HttpStatus.OK);
    expect(body.firstname).toBe(seedBooking.firstname);
    expect(body.lastname).toBe(seedBooking.lastname);
    expect(body.totalprice).toBe(seedBooking.totalprice);

    const parsed = bookingSchema.safeParse(body);
    expect(parsed.success, parsed.success ? undefined : JSON.stringify(parsed.error?.issues)).toBe(true);
  });

  test('PUT /booking/{id} updates the booking and the change is reflected on a follow-up GET', async ({
    request,
    authToken,
  }) => {
    const updatedBooking = buildBooking({
      firstname: 'Updated',
      totalprice: seedBooking.totalprice + 50,
    });

    const putResult = await updateBooking(request, bookingId, updatedBooking, authToken);
    expect(putResult.status).toBe(HttpStatus.OK);

    // PUT returns the full updated booking, so the same schema applies.
    const parsed = bookingSchema.safeParse(putResult.body);
    expect(parsed.success, parsed.success ? undefined : JSON.stringify(parsed.error?.issues)).toBe(true);

    const { body } = await getBooking(request, bookingId);
    expect(body.firstname).toBe(updatedBooking.firstname);
    expect(body.totalprice).toBe(updatedBooking.totalprice);
  });

  test('DELETE /booking/{id} removes the booking — verified by a 404 on the follow-up GET', async ({
    request,
    authToken,
  }) => {
    const deleteResult = await deleteBooking(request, bookingId, authToken);
    // Documented Restful Booker quirk: DELETE returns 201, not 204.
    expect(deleteResult.status).toBe(HttpStatus.CREATED);

    const { status } = await getBooking(request, bookingId);
    expect(status).toBe(HttpStatus.NOT_FOUND);
  });
});

test.describe('Booking creation', () => {
  test('POST /booking with valid data — task expects 201; Restful Booker actually returns 200 (documented deviation, see helpers/assertion-notes.txt)', async ({
    request,
    authToken,
  }) => {
    // Marks this test as expected to fail: Playwright reports it green as
    // long as it fails for this reason, and flags it red if it ever starts
    // passing — which would mean Restful Booker changed and this documented
    // deviation (see helpers/assertion-notes.txt) is stale and needs review.
    test.fail();

    const newBooking = buildBooking();
    const { status, body } = await createBooking(request, newBooking);

    try {
      // Written exactly as Stage 2 specifies ("assert 201 status on create").
      // This is expected to fail against the real API.
      expect(status).toBe(HttpStatus.CREATED);

      expect(body.booking.firstname).toBe(newBooking.firstname);
      expect(body.booking.lastname).toBe(newBooking.lastname);
      expect(body.bookingid).toBeDefined();

      const parsed = createBookingResponseSchema.safeParse(body);
      expect(parsed.success, parsed.success ? undefined : JSON.stringify(parsed.error?.issues)).toBe(true);
    } finally {
      if (body?.bookingid) {
        await deleteBooking(request, body.bookingid, authToken);
      }
    }
  });

  test('POST /booking with a wrong Content-Type header — observed behavior, not a fixed expectation', async ({
    request,
    authToken,
  }) => {
    const newBooking = buildBooking();
    const response = await request.post('/booking', {
      data: newBooking,
      headers: { 'Content-Type': 'text/plain' },
    });
    const status = response.status();
    const rawBody = await response.text();

    console.log('Observed status with wrong Content-Type:', status);
    console.log('Observed body:', rawBody);

    // Stage 2 asks to "observe behavior" here, not to assert a guessed outcome,
    // so the only fixed check is that the server responded at all.
    expect(status).toBeGreaterThanOrEqual(HttpStatus.OK);

    // The server may respond with plain text (e.g. "Internal Server Error")
    // instead of JSON for this malformed request, so parsing is best-effort —
    // only clean up if a real booking actually got created.
    try {
      const body = rawBody ? JSON.parse(rawBody) : null;
      if (body?.bookingid) {
        await deleteBooking(request, body.bookingid, authToken);
      }
    } catch {
      // No JSON body to clean up from.
    }
  });
});
