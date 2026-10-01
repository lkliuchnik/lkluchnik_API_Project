import { test, expect } from '@playwright/test';
import { HttpStatus } from '../test-data/httpStatus';

// Stage 1 — first successful API call. Deliberately minimal: prove the
// project, dependencies, and test runner all work end to end against a real API.
test('GET /booking returns a list of booking ids', async ({ request }) => {
  const response = await request.get('/booking');
  const body = await response.json();

  console.log('Status:', response.status());
  console.log('First few entries:', JSON.stringify(body.slice(0, 3), null, 2));

  expect(response.status()).toBe(HttpStatus.OK);
  expect(Array.isArray(body)).toBe(true);
});
