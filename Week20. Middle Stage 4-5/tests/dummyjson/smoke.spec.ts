import { test, expect } from '../../fixtures/dummyjson.fixture';
import { HttpStatus } from '../../test-data/httpStatus';
import { Tag } from '../../config/tags';

// Setup check: the project runs and DummyJSON answers.
test('GET /test returns status ok', { tag: Tag.REGRESSION }, async ({ apiClient }) => {
  const { status, body } = await apiClient.get<{ status: string }>('/test');

  console.log('Status:', status, 'Body:', body);

  expect(status).toBe(HttpStatus.OK);
  expect(body.status).toBe('ok');
});
