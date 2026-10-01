import { test, expect } from '../fixtures/api.fixture';
import { createBooking, deleteBooking, updateBooking } from '../helpers/bookingApi';
import { buildBooking } from '../test-data/bookingFactory';
import { HttpStatus } from '../test-data/httpStatus';

test.describe('Booking auth', () => {
  let bookingId: number;

  test.beforeEach(async ({ request }) => {
    const { body } = await createBooking(request, buildBooking());
    bookingId = body.bookingid;
  });

  test.afterEach(async ({ request, authToken }) => {
    await deleteBooking(request, bookingId, authToken);
  });

  test('PUT /booking/{id} without a token returns 401', async ({ request }) => {
    test.fail(); // known deviation: the API returns 403, see assertion-notes.txt

    const response = await request.put(`/booking/${bookingId}`, { data: buildBooking() });

    expect(response.status()).toBe(HttpStatus.UNAUTHORIZED);
  });

  test('PUT /booking/{id} with a valid token returns 200', async ({ request, authToken }) => {
    const result = await updateBooking(request, bookingId, buildBooking(), authToken);

    expect(result.status).toBe(HttpStatus.OK);
  });
});
