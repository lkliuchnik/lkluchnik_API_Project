import { test, expect } from '@playwright/test';
import { HttpStatus } from '../test-data/httpStatus';

// Stage 1: first API call - proves the project setup works.
test('GET /booking returns a list of booking ids', async ({ request }) => {
  const response = await request.get('/booking');
  const body = await response.json();

  console.log('Status:', response.status());
  console.log('First entries:', body.slice(0, 3));

  expect(response.status()).toBe(HttpStatus.OK);
  expect(Array.isArray(body)).toBe(true);
});
