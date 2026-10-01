import { test, expect } from '../fixtures/api.fixture';
import { createBooking, getBooking, deleteBooking } from '../helpers/bookingApi';
import { buildBooking } from '../test-data/bookingFactory';
import { HttpStatus } from '../test-data/httpStatus';

// This test creates and cleans up all of its own data and reads no state left
// behind by any other test. It can be run alone
// (npx playwright test bookingIsolation.spec.ts) or in any order relative to
// the rest of the suite and will behave identically either way.
test("a booking created by this test exists only for this test's own lifecycle", async ({
  request,
  authToken,
}) => {
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
