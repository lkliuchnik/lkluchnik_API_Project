import { test, expect } from '@playwright/test';
import { getBookingIds } from '../helpers/bookingApi';
import { HttpStatus } from '../test-data/httpStatus';

test.describe('Booking collection', () => {
  test('GET /booking: every entry has a numeric bookingid', async ({ request }) => {
    const { status, body } = await getBookingIds(request);

    expect(status).toBe(HttpStatus.OK);

    const allHaveNumericId = body.every((entry: { bookingid?: unknown }) => typeof entry?.bookingid === 'number');
    expect(allHaveNumericId).toBe(true);
  });

  test('GET /booking with a filter that matches nothing returns an empty list', async ({ request }) => {
    const { status, body } = await getBookingIds(request, '?firstname=DoesNotExist12345');

    expect(status).toBe(HttpStatus.OK);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(0);

    // body[0] does not exist - ?. returns undefined instead of crashing
    expect(body[0]?.bookingid).toBeUndefined();
  });
});
