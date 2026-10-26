import { test, expect } from '../../fixtures/dummyjson.fixture';
import { HttpStatus } from '../../test-data/httpStatus';
import { Tag } from '../../config/tags';

// The same test passes in every environment: TEST_ENV=dev logs in as emilys,
// TEST_ENV=staging as michaelw. Nothing in the code changes between the two runs.
test('the tests log in as the test user of the selected environment', { tag: [Tag.REGRESSION, Tag.SMOKE] }, async ({ authApi, env }) => {
  test.info().annotations.push({ type: 'environment', description: `${env.name} (${env.dummyjson.username})` });

  const { status, body } = await authApi.auth.getCurrentUser();

  expect(status).toBe(HttpStatus.OK);
  expect(body.username).toBe(env.dummyjson.username);
});
