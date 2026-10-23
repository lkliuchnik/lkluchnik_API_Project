import { randomInt } from 'crypto';
import { Order } from '../../models/petstore/order';
import { Pet } from '../../models/petstore/pet';
import { PetStoreUser } from '../../models/petstore/user';

// A unique id that JavaScript can hold exactly. The PetStore makes ids like
// 9223372016900055439 when the id is left out - bigger than Number.MAX_SAFE_INTEGER, so the
// number would be rounded and a later GET or DELETE would hit another pet. A random number
// below 2^48 (about 2.8e14) is safe, and two tests - also two calls in the same millisecond -
// practically never get the same one. randomInt cannot go higher than 2^48.
export function uniqueId(): number {
  return randomInt(1, 2 ** 48);
}

export function buildPet(overrides: Partial<Pet> = {}): Pet {
  const id = uniqueId();
  return {
    id,
    name: `qa-pet-${id}`,
    photoUrls: ['https://example.com/qa-pet.png'],
    status: 'available',
    category: { id: 1, name: 'Dogs' },
    tags: [{ id: 1, name: 'qa-sandbox' }],
    ...overrides,
  };
}

export function buildOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: uniqueId(),
    petId: 1,
    quantity: 1,
    shipDate: '2026-10-23T10:00:00.000Z',
    status: 'placed',
    complete: false,
    ...overrides,
  };
}

export function buildPetStoreUser(overrides: Partial<PetStoreUser> = {}): PetStoreUser {
  const id = uniqueId();
  return {
    id,
    username: `qa_user_${id}`,
    firstName: 'Qa',
    lastName: 'Sandbox',
    email: `qa_user_${id}@example.com`,
    password: 'Secret#123',
    phone: '0000000',
    userStatus: 0,
    ...overrides,
  };
}
