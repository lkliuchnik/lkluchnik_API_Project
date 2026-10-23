import { test, expect } from '../../fixtures/petstore.fixture';
import { expectPetStoreError } from '../../assertions/petstore/errorAssertions';
import { buildOrder } from '../../test-data/petstore/petFactory';
import { HttpStatus } from '../../test-data/httpStatus';

// Boundary value analysis for a date: shipDate of POST /store/order (a date-time, swagger
// format "date-time"). The limits of a date are the calendar itself: the last day of a month,
// the leap day, the last month of a year, the smallest and the largest year with 4 digits.
// Each limit is tested on the value (accepted and kept exactly as sent) and, where the
// calendar has one, just past it (rejected with 400). Where the PetStore answers
// differently, the case is marked test.fail - see assertion-notes.txt.

// The PetStore writes a UTC moment as "+0000" instead of "Z": "...00.000Z" comes back as
// "...00.000+0000". Both mean the same moment, so the check compares them that way.
function asSent(stored: string) {
  return stored.replace(/\+0000$/, 'Z');
}

const accepted = [
  { title: 'the last day of February: 2027-02-28 is kept as sent', shipDate: '2027-02-28T00:00:00.000Z' },
  { title: 'a leap day: 2028-02-29 is kept as sent', shipDate: '2028-02-29T00:00:00.000Z' },
  { title: 'the last moment of a year: 2026-12-31 23:59:59.999 is kept as sent', shipDate: '2026-12-31T23:59:59.999Z' },
  { title: 'the smallest year: 0001-01-01 is kept as sent', shipDate: '0001-01-01T00:00:00.000Z' },
  { title: 'the largest 4-digit year: 9999-12-31 is kept as sent', shipDate: '9999-12-31T23:59:59.999Z' },
];

// known deviations: a date that does not exist is not rejected - the PetStore rolls it over
// to a real one (2027-02-29 is stored as 2027-03-01, month 13 of 2026 as January 2027), and
// a 5-digit year crashes the server (500 "something bad happened")
const rejected = [
  { title: 'one day past February: 2027-02-29 is rejected with 400', shipDate: '2027-02-29T00:00:00.000Z' },
  { title: 'one month past December: month 13 is rejected with 400', shipDate: '2026-13-01T00:00:00.000Z' },
  { title: 'one year past 9999: 10000-01-01 is rejected with 400', shipDate: '10000-01-01T00:00:00.000Z' },
];

test.describe('Boundaries: POST /store/order shipDate (date-time)', () => {
  for (const c of accepted) {
    test(c.title, async ({ petstore, petstoreCleanup }) => {
      const order = buildOrder({ shipDate: c.shipDate });
      petstoreCleanup.order(order.id);

      const { status, body } = await petstore.store.createOrder(order);

      expect(status).toBe(HttpStatus.OK);
      expect(asSent(body.shipDate), 'the answer').toBe(c.shipDate);
      const { status: readStatus, body: saved } = await petstore.store.getOrder(order.id);
      expect(readStatus, 'GET /store/order/{id}').toBe(HttpStatus.OK);
      expect(asSent(saved.shipDate), 'what GET shows later').toBe(c.shipDate);
    });
  }

  for (const c of rejected) {
    test.fail(c.title, async ({ petstore, petstoreCleanup }) => {
      const order = buildOrder({ shipDate: c.shipDate });
      petstoreCleanup.order(order.id); // in case the PetStore stores it anyway

      await expectPetStoreError(await petstore.store.createOrder(order), { status: HttpStatus.BAD_REQUEST });
      const { status } = await petstore.store.getOrder(order.id);
      expect(status, 'a rejected order is not stored').toBe(HttpStatus.NOT_FOUND);
    });
  }
});
