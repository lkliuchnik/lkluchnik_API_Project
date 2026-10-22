import { test as base, expect } from './base.fixture';
import { ApiClient } from '../api/ApiClient';
import { createApiClient } from '../api/createApiClient';
import { PetService } from '../services/petstore/PetService';
import { PetStoreUserService } from '../services/petstore/PetStoreUserService';
import { StoreService } from '../services/petstore/StoreService';
import { HttpStatus } from '../test-data/httpStatus';

// All PetStore services on one client. A new service is added here - one line.
function servicesFor(client: ApiClient) {
  return {
    pets: new PetService(client),
    users: new PetStoreUserService(client),
    store: new StoreService(client),
  };
}

export type PetStoreApi = ReturnType<typeof servicesFor>;

type PetStoreCleanup = {
  pet(id: number): void; // delete this pet after the test
  user(username: string): void; // delete this user after the test
};

type PetStoreFixtures = {
  petstore: PetStoreApi;
  petstoreCleanup: PetStoreCleanup;
};

export const test = base.extend<PetStoreFixtures>({
  petstore: async ({ request, env, apiLog }, use) => {
    const client = createApiClient(request, { baseUrl: env.petstore.baseUrl, http: env.http, log: apiLog });
    await use(servicesFor(client));
  },

  // Shared hook: the server is public, so every pet and user a test makes is deleted after the
  // test, also when it fails half-way. 404 is fine - the test may have deleted it itself.
  // Anything else is marked in the report as "leaked data".
  petstoreCleanup: async ({ petstore }, use, testInfo) => {
    const petIds: number[] = [];
    const usernames: string[] = [];
    await use({
      pet: (id) => petIds.push(id),
      user: (username) => usernames.push(username),
    });

    const deletions = [
      ...petIds.map((id) => ({ what: `pet ${id}`, run: () => petstore.pets.delete(id) })),
      ...usernames.map((name) => ({ what: `user ${name}`, run: () => petstore.users.delete(name) })),
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
});

export { expect };
