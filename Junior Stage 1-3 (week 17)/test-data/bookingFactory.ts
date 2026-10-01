export interface BookingPayload {
  firstname: string;
  lastname: string;
  totalprice: number;
  depositpaid: boolean;
  bookingdates: {
    checkin: string;
    checkout: string;
  };
  additionalneeds?: string;
}

let sequence = 0;

// Returns new booking data with unique names on every call.
export function buildBooking(overrides: Partial<BookingPayload> = {}): BookingPayload {
  sequence += 1;
  const unique = `${Date.now()}-${sequence}`;

  return {
    firstname: `Test${unique}`,
    lastname: `User${unique}`,
    totalprice: 100 + sequence,
    depositpaid: true,
    bookingdates: {
      checkin: '2026-01-01',
      checkout: '2026-01-05',
    },
    additionalneeds: 'Breakfast',
    ...overrides,
  };
}
