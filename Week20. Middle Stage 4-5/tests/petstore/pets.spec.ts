import { test, expect } from '../../fixtures/petstore.fixture';
import { buildPet, buildPetStoreUser } from '../../test-data/petstore/petFactory';
import { HttpStatus } from '../../test-data/httpStatus';
import { Tag } from '../../config/tags';

// PetStore really keeps data, so a change can be checked with a second request.
// The server is public and shared: every test makes its own pets and users with unique ids.

test('a new pet can be read, changed and deleted', { tag: [Tag.REGRESSION, Tag.SMOKE] }, async ({ petstore, petstoreCleanup }) => {
  const pet = buildPet();
  petstoreCleanup.pet(pet.id);

  await test.step('POST /pet creates the pet', async () => {
    const { status, body } = await petstore.pets.create(pet);
    // DELIBERATE MISTAKE for the failure classification demo (Middle Stage 5, step 5): the test
    // expects the REST habit "201 Created", but the PetStore answers 200. Reverted in the next commit.
    expect(status).toBe(HttpStatus.CREATED);
    expect(body).toEqual(pet);
  });

  await test.step('GET /pet/{id} returns what was sent', async () => {
    const { status, body } = await petstore.pets.get(pet.id);
    expect(status).toBe(HttpStatus.OK);
    expect(body).toEqual(pet);
  });

  await test.step('PUT /pet changes the status, and GET shows the change', async () => {
    const { status } = await petstore.pets.update({ ...pet, status: 'sold' });
    expect(status).toBe(HttpStatus.OK);
    const { body } = await petstore.pets.get(pet.id);
    expect(body.status).toBe('sold');
  });

  await test.step('DELETE /pet/{id} removes it, and GET gives 404', async () => {
    const deleted = await petstore.pets.delete(pet.id);
    expect(deleted.status).toBe(HttpStatus.OK);
    const { status, body } = await petstore.pets.get(pet.id);
    expect(status).toBe(HttpStatus.NOT_FOUND);
    expect(body.message).toBe('Pet not found');
  });
});

test('POST /user/createWithArray creates every user in the list', { tag: Tag.REGRESSION }, async ({ petstore, petstoreCleanup }) => {
  const users = [buildPetStoreUser(), buildPetStoreUser()];
  users.forEach((user) => petstoreCleanup.user(user.username));

  const { status } = await petstore.users.createWithArray(users);
  expect(status).toBe(HttpStatus.OK);

  for (const user of users) {
    const { status: readStatus, body } = await petstore.users.get(user.username);
    expect.soft(readStatus, user.username).toBe(HttpStatus.OK);
    expect.soft(body.id, user.username).toBe(user.id);
  }
});
