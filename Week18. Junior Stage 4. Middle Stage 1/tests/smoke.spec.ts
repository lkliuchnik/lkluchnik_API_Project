import { test, expect } from '@playwright/test';

// Setup check: the project runs and DummyJSON answers.
test('GET /test returns status ok', async ({ request }) => {
  const response = await request.get('/test');
  const body = await response.json();

  console.log('Status:', response.status(), 'Body:', body);

  expect(response.status()).toBe(200);
  expect(body.status).toBe('ok');
});
