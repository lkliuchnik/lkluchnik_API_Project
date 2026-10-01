import { APIRequestContext } from '@playwright/test';
import { BookingPayload } from '../test-data/bookingFactory';

async function readBody(response: { text: () => Promise<string> }) {
  const raw = await response.text();
  if (!raw) return null;

  // some error responses are plain text ("Not Found"), not JSON
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

// If the token is rejected (403 in Restful Booker), get a new one and try once more.
export async function updateBookingWithRetry(
  request: APIRequestContext,
  id: number,
  booking: BookingPayload,
  token: string,
) {
  const firstTry = await updateBooking(request, id, booking, token);
  if (firstTry.status !== 403) {
    return { ...firstTry, retried: false };
  }

  const newToken = await createAuthToken(request);
  const secondTry = await updateBooking(request, id, booking, newToken);
  return { ...secondTry, retried: true };
}

export async function deleteBooking(request: APIRequestContext, id: number, token: string) {
  const response = await request.delete(`/booking/${id}`, {
    headers: { Cookie: `token=${token}` },
  });
  return { status: response.status() };
}
