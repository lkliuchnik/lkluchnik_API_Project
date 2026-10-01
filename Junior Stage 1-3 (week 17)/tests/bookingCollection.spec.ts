import { test, expect } from '@playwright/test';
import { getBookingIds } from '../helpers/bookingApi';
import { HttpStatus } from '../test-data/httpStatus';

test.describe('Booking collection', () => {
  test('GET /booking returns a list where every entry has a numeric bookingid', async ({ request }) => {
    const { status, body } = await getBookingIds(request);

    // Strict equality on the status check, as required.
    expect(status === HttpStatus.OK).toBe(true);

    const allHaveNumericId: boolean = body.every(
      (entry: { bookingid?: unknown }) => typeof entry?.bookingid === 'number',
    );
    expect(allHaveNumericId).toBe(true);
  });

  test('GET /booking with a filter that matches nothing safely handles a possibly empty result', async ({
    request,
  }) => {
    const { body } = await getBookingIds(request, '?firstname=DoesNotExist12345');

    // Handle a potentially empty array without assuming index 0 exists.
    const firstEntry = body?.[0];
    const isSafe = firstEntry === undefined || typeof firstEntry.bookingid === 'number';
    expect(isSafe).toBe(true);
  });
});
