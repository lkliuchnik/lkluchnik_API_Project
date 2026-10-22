import { test, expect, PetStoreApi } from '../../fixtures/petstore.fixture';
import { expectPetStoreError } from '../../assertions/petstore/errorAssertions';
import { ApiResponse } from '../../models/common';
import { PetStoreMessage } from '../../models/petstore/message';
import { uniqueId } from '../../test-data/petstore/petFactory';
import { HttpStatus } from '../../test-data/httpStatus';

// Error consistency: the PetStore swagger describes one error object for all endpoints -
// { code, type, message } (expectPetStoreError). The tests check it on pets, users and
// orders. A random unique id is an id nobody uses on the shared server.
// Where the PetStore answers differently, the case is marked test.fail - see assertion-notes.txt.

type ErrorCase = {
  title: string; // endpoint - what is wrong with the request
  send: (api: PetStoreApi) => Promise<ApiResponse<PetStoreMessage>>;
  status: number;
};

// a user name nobody has on the shared server
const nobody = () => `qa_nobody_${uniqueId()}`;

const cases: ErrorCase[] = [
  { title: 'GET /pet/{id} - unknown id', send: (api) => api.pets.get(uniqueId()), status: HttpStatus.NOT_FOUND },
  // the answer is right in shape, but its message is a Java error ("java.lang.NumberFormatException...")
  { title: 'GET /pet/{id} - id that is not a number', send: (api) => api.pets.get('abc'), status: HttpStatus.NOT_FOUND },
  {
    title: 'POST /pet - body that is not valid JSON',
    send: (api) => api.pets.createRaw(Buffer.from('{"id":')),
    status: HttpStatus.BAD_REQUEST,
  },
  { title: 'GET /user/{username} - unknown user', send: (api) => api.users.get(nobody()), status: HttpStatus.NOT_FOUND },
  { title: 'GET /store/order/{id} - unknown id', send: (api) => api.store.getOrder(uniqueId()), status: HttpStatus.NOT_FOUND },
  { title: 'DELETE /store/order/{id} - unknown id', send: (api) => api.store.deleteOrder(uniqueId()), status: HttpStatus.NOT_FOUND },
];

// known deviations: DELETE of an unknown pet or user answers 404 with an EMPTY body;
// an id of the wrong type in the body is a client error, but the PetStore answers 500
const deviations: ErrorCase[] = [
  { title: 'DELETE /pet/{id} - unknown id', send: (api) => api.pets.delete(uniqueId()), status: HttpStatus.NOT_FOUND },
  {
    title: 'DELETE /user/{username} - unknown user',
    send: (api) => api.users.delete(nobody()),
    status: HttpStatus.NOT_FOUND,
  },
  {
    title: 'POST /pet - id that is not a number',
    send: (api) => api.pets.createRaw({ id: 'abc', name: 'qa-pet', photoUrls: [] }),
    status: HttpStatus.BAD_REQUEST,
  },
];

test.describe('PetStore errors have one shape on every endpoint', () => {
  for (const c of cases) {
    test(`${c.title}: ${c.status} with { code, type, message }`, async ({ petstore }) => {
      await expectPetStoreError(await c.send(petstore), { status: c.status });
    });
  }

  for (const c of deviations) {
    test.fail(`${c.title}: ${c.status} with { code, type, message }`, async ({ petstore }) => {
      await expectPetStoreError(await c.send(petstore), { status: c.status });
    });
  }

  // known deviation: GET says "not found" as code 1 / type "error", DELETE of an order as
  // code 404 / type "unknown" - a client cannot rely on code and type
  test.fail('"not found" has the same code and type on every endpoint', async ({ petstore }) => {
    const answers = [
      await petstore.pets.get(uniqueId()),
      await petstore.users.get(nobody()),
      await petstore.store.getOrder(uniqueId()),
      await petstore.store.deleteOrder(uniqueId()),
    ];

    const kinds = answers.map(({ body }) => `code ${body.code}, type ${body.type}`);
    expect(new Set(kinds).size, `one kind of "not found" expected, got: ${kinds.join(' | ')}`).toBe(1);
  });
});
