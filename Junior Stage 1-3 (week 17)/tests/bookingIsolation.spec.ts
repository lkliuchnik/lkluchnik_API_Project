import { test, expect } from '../fixtures/api.fixture';
import { createBooking, getBooking, deleteBooking } from '../helpers/bookingApi';
import { buildBooking } from '../test-data/bookingFactory';
import { HttpStatus } from '../test-data/httpStatus';

// Stage 3: isolation - uses only its own data, can run alone or in any order.
test('a test creates, checks and deletes its own booking', async ({ request, authToken }) => {
  const booking = buildBooking();
  const { body: created } = await createBooking(request, booking);
  const bookingId = created.bookingid;

  const { status, body } = await getBooking(request, bookingId);
  expect(status).toBe(HttpStatus.OK);
  expect(body.firstname).toBe(booking.firstname);

  await deleteBooking(request, bookingId, authToken);

  const { status: statusAfterDelete } = await getBooking(request, bookingId);
  expect(statusAfterDelete).toBe(HttpStatus.NOT_FOUND);
});
