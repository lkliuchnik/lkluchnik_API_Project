import { test, expect } from '../../fixtures/petstore.fixture';
import { buildPet } from '../../test-data/petstore/petFactory';
import { HttpStatus } from '../../test-data/httpStatus';

// Idempotency: sending the same request a second time leaves the server in the same state as
// sending it once. PUT and DELETE must work this way - it is what makes a retry safe (the
// client retries a DELETE after 502/503/504, api/interceptors/retry.ts). POST does not have
// to, and the client never retries it.
// The answer to the second request may differ (DELETE: 200, then 404) - the STATE must not.

test.describe('Idempotency: the same request twice', () => {
  test('PUT /pet twice with the same body: the pet is the same after the second PUT', async ({ petstore, pet }) => {
    const changed = { ...pet, name: `${pet.name}-renamed`, status: 'sold' as const };

    const first = await petstore.pets.update(changed);
    const { body: afterFirst } = await petstore.pets.get(pet.id);
    const second = await petstore.pets.update(changed);
    const { body: afterSecond } = await petstore.pets.get(pet.id);

    expect([first.status, second.status]).toEqual([HttpStatus.OK, HttpStatus.OK]);
    expect(afterFirst, 'after the first PUT').toEqual(changed);
    expect(afterSecond, 'after the second PUT: nothing more changed').toEqual(afterFirst);
  });

  test('DELETE /pet twice: the pet stays deleted, and nothing else changes', async ({
    petstore,
    pet,
    petstoreCleanup,
  }) => {
    const neighbour = buildPet();
    petstoreCleanup.pet(neighbour.id);
    const { status: created } = await petstore.pets.create(neighbour);
    expect(created, 'precondition: POST /pet (a second pet)').toBe(HttpStatus.OK);

    const first = await petstore.pets.delete(pet.id);
    const second = await petstore.pets.delete(pet.id);

    // the second answer only says "already gone" - its body shape is deviation 24, not checked here
    expect([first.status, second.status]).toEqual([HttpStatus.OK, HttpStatus.NOT_FOUND]);
    const { status: deletedPet } = await petstore.pets.get(pet.id);
    expect(deletedPet, 'the pet stays deleted').toBe(HttpStatus.NOT_FOUND);
    const { status: neighbourStatus, body: neighbourNow } = await petstore.pets.get(neighbour.id);
    expect(neighbourStatus, 'the other pet is still there').toBe(HttpStatus.OK);
    expect(neighbourNow).toEqual(neighbour);
  });
});
