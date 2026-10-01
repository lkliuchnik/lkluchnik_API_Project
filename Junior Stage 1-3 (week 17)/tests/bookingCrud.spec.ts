import { test, expect } from '../fixtures/api.fixture';
import { createBooking, getBooking, updateBooking, deleteBooking } from '../helpers/bookingApi';
import { buildBooking, BookingPayload } from '../test-data/bookingFactory';
import { bookingSchema, createBookingResponseSchema } from '../models/booking.model';
import { HttpStatus } from '../test-data/httpStatus';

test.describe('Booking CRUD', () => {
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

  test('GET /booking/{id} returns the created booking', async ({ request }) => {
    const { status, body } = await getBooking(request, bookingId);

    expect(status).toBe(HttpStatus.OK);
    expect(body.firstname).toBe(seedBooking.firstname);
    expect(body.lastname).toBe(seedBooking.lastname);
    expect(body.totalprice).toBe(seedBooking.totalprice);
    expect(() => bookingSchema.parse(body)).not.toThrow();
  });

  test('PUT /booking/{id} updates the booking', async ({ request, authToken }) => {
    const updatedBooking = buildBooking({ firstname: 'Updated', totalprice: 999 });

    const putResult = await updateBooking(request, bookingId, updatedBooking, authToken);
    expect(putResult.status).toBe(HttpStatus.OK);
    expect(() => bookingSchema.parse(putResult.body)).not.toThrow();

    const { body } = await getBooking(request, bookingId);
    expect(body.firstname).toBe('Updated');
    expect(body.totalprice).toBe(999);
  });

  test('DELETE /booking/{id} removes the booking', async ({ request, authToken }) => {
    const deleteResult = await deleteBooking(request, bookingId, authToken);
    expect(deleteResult.status).toBe(HttpStatus.CREATED); // Restful Booker returns 201 for DELETE

    const { status } = await getBooking(request, bookingId);
    expect(status).toBe(HttpStatus.NOT_FOUND);
  });
});

test.describe('Booking creation', () => {
  let createdId: number | undefined;

  test.afterEach(async ({ request, authToken }) => {
    if (createdId) {
      await deleteBooking(request, createdId, authToken);
      createdId = undefined;
    }
  });

  test('POST /booking with valid data returns 201 and the new booking id', async ({ request }) => {
    test.fail(); // known deviation: the API returns 200, see assertion-notes.txt

    const newBooking = buildBooking();
    const { status, body } = await createBooking(request, newBooking);
    createdId = body.bookingid;

    expect(status).toBe(HttpStatus.CREATED);
    expect(body.booking.firstname).toBe(newBooking.firstname);
    expect(body.booking.lastname).toBe(newBooking.lastname);
    expect(() => createBookingResponseSchema.parse(body)).not.toThrow();
  });

  test('POST /booking with a wrong Content-Type (observe the response)', async ({ request }) => {
    const response = await request.post('/booking', {
      data: buildBooking(),
      headers: { 'Content-Type': 'text/plain' },
    });

    console.log('Status with wrong Content-Type:', response.status());
    console.log('Body:', await response.text());

    // The task says "observe", so we only check that the server answered.
    expect(response.status()).toBeGreaterThanOrEqual(HttpStatus.OK);

    if (response.ok()) {
      createdId = (await response.json()).bookingid;
    }
  });
});
