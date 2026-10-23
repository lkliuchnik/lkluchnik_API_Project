import { test, expect, PetStoreApi } from '../../fixtures/petstore.fixture';
import { PetStoreUser } from '../../models/petstore/user';
import { buildPetStoreUser } from '../../test-data/petstore/petFactory';
import { HttpStatus } from '../../test-data/httpStatus';

// Partial failures in a bulk operation: POST /user/createWithArray creates a LIST of users in
// one request. The rule checked here: if the request fails, NOBODY from the list is created
// (all or nothing) - the client gets an error and must be able to send the list again.
// Contrast: the DemoQA bulk add (bookstore/bulkAdd.spec.ts) adds the good items.
// Every user is checked on the server with GET /user/{username}, not only the answer.

// 502/503/504 come from the gateway in front of the PetStore: the request never reached the
// server, so the rule cannot be judged. The test is then skipped with the reason - not passed
// (it would read as "refused") and not counted as the expected failure of a test.fail.
const GATEWAY_ERRORS: number[] = [HttpStatus.BAD_GATEWAY, HttpStatus.SERVICE_UNAVAILABLE, HttpStatus.GATEWAY_TIMEOUT];

function skipIfGatewayError(request: string, status: number) {
  test.skip(GATEWAY_ERRORS.includes(status), `infrastructure: ${request} answered ${status}`);
}

// 200 = the user is there, 404 = not there. Anything else does not answer the question,
// so the test stops instead of reading it as "not there".
async function exists(api: PetStoreApi, user: PetStoreUser) {
  const { status } = await api.users.get(user.username);
  skipIfGatewayError(`GET /user/${user.username}`, status);
  if (status !== HttpStatus.OK && status !== HttpStatus.NOT_FOUND) {
    throw new Error(`GET /user/${user.username} answered ${status} - cannot tell if the user exists`);
  }
  return status === HttpStatus.OK;
}

test.describe('Bulk create: one invalid user in a list', () => {
  // a field of the wrong type: the list cannot be read at all, so nothing is processed
  test('a user with a wrong field type: the request fails and nobody is created', async ({
    petstore,
    petstoreCleanup,
  }) => {
    const [first, last] = [buildPetStoreUser(), buildPetStoreUser()];
    const broken = { ...buildPetStoreUser(), id: 'not-a-number' };
    [first, broken, last].forEach((user) => petstoreCleanup.user(user.username));

    const { status, ok } = await petstore.users.createWithArray([first, broken, last]);
    skipIfGatewayError('POST /user/createWithArray', status);

    expect(ok, 'the request is reported as failed').toBe(false);
    expect.soft(await exists(petstore, first), `${first.username} (before the bad item)`).toBe(false);
    expect.soft(await exists(petstore, last), `${last.username} (after the bad item)`).toBe(false);
  });

  // known deviation: 500, but the users BEFORE the empty item are created, the ones after it
  // are not - an error answer for a request that changed data.
  // The rule holds for both correct designs: success = everybody is there, error = nobody.
  test.fail('an empty item (null): all users are created, or none of them', async ({ petstore, petstoreCleanup }) => {
    const [first, last] = [buildPetStoreUser(), buildPetStoreUser()];
    [first, last].forEach((user) => petstoreCleanup.user(user.username));

    const { status, ok } = await petstore.users.createWithArray([first, null, last]);
    skipIfGatewayError('POST /user/createWithArray', status);

    const created = [await exists(petstore, first), await exists(petstore, last)];
    expect(created, `answer ${ok ? 'success' : 'error'}: [first user exists, last user exists]`).toEqual([ok, ok]);
  });
});
