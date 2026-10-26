import { test as base, expect } from './base.fixture';
import { ApiClient } from '../api/ApiClient';
import { createApiClient } from '../api/createApiClient';
import { PetService } from '../services/petstore/PetService';
import { PetStoreUserService } from '../services/petstore/PetStoreUserService';
import { StoreService } from '../services/petstore/StoreService';
import { SwaggerService } from '../services/petstore/SwaggerService';
import { Pet } from '../models/petstore/pet';
import { buildPet } from '../test-data/petstore/petFactory';
import { HttpStatus } from '../test-data/httpStatus';
import { setupStep } from './infrastructure';

// All PetStore services on one client. A new service is added here - one line.
function servicesFor(client: ApiClient) {
  return {
    pets: new PetService(client),
    users: new PetStoreUserService(client),
    store: new StoreService(client),
    swagger: new SwaggerService(client),
  };
}

export type PetStoreApi = ReturnType<typeof servicesFor>;

type PetStoreCleanup = {
  pet(id: number): void; // delete this pet after the test
  user(username: string): void; // delete this user after the test
  order(id: number): void; // delete this order after the test
};

type PetStoreFixtures = {
  petstore: PetStoreApi;
  petstoreCleanup: PetStoreCleanup;
  pet: Pet; // a NEW pet, created before the test and deleted after it
};

export const test = base.extend<PetStoreFixtures>({
  petstore: async ({ request, env, apiLog }, use) => {
    const client = createApiClient(request, { baseUrl: env.petstore.baseUrl, http: env.http, log: apiLog });
    await use(servicesFor(client));
  },

  // Shared hook: the server is public, so every pet, user and order a test makes is deleted
  // after the test, also when it fails half-way. 404 is fine - the test may have deleted it
  // itself. Anything else is marked in the report as "leaked data".
  petstoreCleanup: async ({ petstore }, use, testInfo) => {
    const petIds: number[] = [];
    const usernames: string[] = [];
    const orderIds: number[] = [];
    await use({
      pet: (id) => petIds.push(id),
      user: (username) => usernames.push(username),
      order: (id) => orderIds.push(id),
    });

    const deletions = [
      ...petIds.map((id) => ({ what: `pet ${id}`, run: () => petstore.pets.delete(id) })),
      ...usernames.map((name) => ({ what: `user ${name}`, run: () => petstore.users.delete(name) })),
      ...orderIds.map((id) => ({ what: `order ${id}`, run: () => petstore.store.deleteOrder(id) })),
    ];
    const results = await Promise.allSettled(
      deletions.map(async ({ run }) => {
        const { status } = await run();
        if (status !== HttpStatus.OK && status !== HttpStatus.NOT_FOUND) throw new Error(`DELETE answered ${status}`);
      }),
    );
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        testInfo.annotations.push({ type: 'leaked data', description: `${deletions[i].what}: ${result.reason}` });
      }
    });
  },

  // Seeded data that really exists on the server.
  pet: async ({ petstore, petstoreCleanup }, use, testInfo) => {
    const pet = buildPet();
    petstoreCleanup.pet(pet.id);
    const { status } = await setupStep(testInfo, 'POST /pet', () => petstore.pets.create(pet));
    expect(status, 'precondition: POST /pet').toBe(HttpStatus.OK);
    await use(pet);
  },
});

export { expect };
