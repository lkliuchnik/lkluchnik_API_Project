import { APIRequestContext } from '@playwright/test';
import { BookingPayload } from '../test-data/bookingFactory';

async function readBody(response: { text: () => Promise<string> }) {
  const raw = await response.text();
  if (!raw) return null;

  // Restful Booker returns plain text (e.g. "Not Found", "Internal Server
  // Error") for some non-2xx responses instead of JSON. Fall back to the raw
  // text so callers can still inspect status codes without a parse crash.
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export async function createAuthToken(request: APIRequestContext): Promise<string> {
  const response = await request.post('/auth', {
    data: {
      username: process.env.AUTH_USERNAME ?? 'admin',
      password: process.env.AUTH_PASSWORD ?? 'password123',
    },
  });
  const body = await readBody(response);
  return body?.token;
}

export async function createBooking(request: APIRequestContext, booking: BookingPayload) {
  const response = await request.post('/booking', { data: booking });
  return { status: response.status(), body: await readBody(response) };
}

export async function getBooking(request: APIRequestContext, id: number) {
  const response = await request.get(`/booking/${id}`);
  return { status: response.status(), body: await readBody(response) };
}

export async function getBookingIds(request: APIRequestContext, query = '') {
  const response = await request.get(`/booking${query}`);
  return { status: response.status(), body: await readBody(response) };
}

export async function updateBooking(
  request: APIRequestContext,
  id: number,
  booking: BookingPayload,
  token: string,
) {
  const response = await request.put(`/booking/${id}`, {
    data: booking,
    headers: { Cookie: `token=${token}` },
  });
  return { status: response.status(), body: await readBody(response) };
}

export async function patchBooking(
  request: APIRequestContext,
  id: number,
  fields: Partial<BookingPayload>,
  token: string,
) {
  const response = await request.patch(`/booking/${id}`, {
    data: fields,
    headers: { Cookie: `token=${token}` },
  });
  return { status: response.status(), body: await readBody(response) };
}

// Restful Booker rejects a missing/invalid/expired token with 403 (not 401),
// so both codes are treated as "the token is no longer good".
const AUTH_REJECTED_STATUSES = [401, 403];

// Runs an authenticated call; if the server rejects the token, obtains a fresh
// one and retries exactly once. A single retry is deliberate: a second
// rejection with a brand-new token means a real auth problem, not an expired
// token, and should surface as a failure instead of looping.
export async function withAuthRetry<T extends { status: number }>(
  request: APIRequestContext,
  token: string,
  action: (token: string) => Promise<T>,
) {
  const first = await action(token);
  if (!AUTH_REJECTED_STATUSES.includes(first.status)) {
    return { ...first, retried: false, token };
  }

  const freshToken = await createAuthToken(request);
  const second = await action(freshToken);
  return { ...second, retried: true, token: freshToken };
}

export async function deleteBooking(request: APIRequestContext, id: number, token: string) {
  const response = await request.delete(`/booking/${id}`, {
    headers: { Cookie: `token=${token}` },
  });
  return { status: response.status() };
}
