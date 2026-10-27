import { test, expect } from '../../fixtures/petstore.fixture';
import { expectSchema, pinnedPetStoreSwagger } from '../../assertions/schemaAssertions';
import { buildOrder, buildPet, buildPetStoreUser, uniqueId } from '../../test-data/petstore/petFactory';
import { HttpStatus } from '../../test-data/httpStatus';
import { Tag } from '../../config/tags';

// Schema validation against the PetStore's own published contract: its swagger.json. We keep a
// pinned copy in schemas/petstore/swagger.json and check the answers against its definitions
// (Pet, Order, User, ApiResponse). The last test compares the pinned copy with the live
// swagger: if the PetStore changes its contract, that test fails and the change is reviewed
// on purpose (helpers/schema-changes.txt) instead of slipping in unnoticed.

test.describe('PetStore answers match the published swagger', { tag: Tag.REGRESSION }, () => {
  test('POST /pet and GET /pet/{id} answer a Pet', async ({ petstore, petstoreCleanup }) => {
    const pet = buildPet();
    petstoreCleanup.pet(pet.id);

    const { status: created, body: answer } = await petstore.pets.create(pet);
    expect(created).toBe(HttpStatus.OK);
    await expectSchema(answer, 'petstore/swagger#/definitions/Pet');

    const { status, body } = await petstore.pets.get(pet.id);
    expect(status).toBe(HttpStatus.OK);
    await expectSchema(body, 'petstore/swagger#/definitions/Pet');
  });

  test('GET /store/order/{id} answers an Order', async ({ petstore, petstoreCleanup }) => {
    const order = buildOrder();
    petstoreCleanup.order(order.id);
    const { status: created } = await petstore.store.createOrder(order);
    expect(created, 'precondition: POST /store/order').toBe(HttpStatus.OK);

    const { status, body } = await petstore.store.getOrder(order.id);

    expect(status).toBe(HttpStatus.OK);
    await expectSchema(body, 'petstore/swagger#/definitions/Order');
  });

  test('GET /user/{username} answers a User', async ({ petstore, petstoreCleanup }) => {
    const user = buildPetStoreUser();
    petstoreCleanup.user(user.username);
    const { status: created } = await petstore.users.createWithArray([user]);
    expect(created, 'precondition: POST /user/createWithArray').toBe(HttpStatus.OK);

    const { status, body } = await petstore.users.get(user.username);

    expect(status).toBe(HttpStatus.OK);
    await expectSchema(body, 'petstore/swagger#/definitions/User');
  });

  // the swagger's ApiResponse has no required fields - even {} or an HTML page turned into
  // { message } would match it, so the strict version petstore/error is used here
  test('an error (GET /pet/{id} of an unknown pet) answers an ApiResponse with all its fields', async ({
    petstore,
  }) => {
    const { status, body } = await petstore.pets.get(uniqueId());

    expect(status).toBe(HttpStatus.NOT_FOUND);
    await expectSchema(body, 'petstore/error');
  });
});

// The parts of the contract that matter to a client: the endpoints and the shapes of the data -
// without the texts written for people (descriptions, summaries, examples), the host or the
// version number. A new text is not a change of the contract; everything else is.
const TEXTS_FOR_PEOPLE = new Set(['description', 'summary', 'example']);

function withoutTexts(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(withoutTexts);
  if (node && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node)
        .filter(([key]) => !TEXTS_FOR_PEOPLE.has(key))
        .map(([key, value]) => [key, withoutTexts(value)]),
    );
  }
  return node;
}

function contractOf(swagger: { paths: object; definitions: object }) {
  return withoutTexts({ paths: swagger.paths, definitions: swagger.definitions });
}

test('the live PetStore swagger is still the pinned copy - a change is reviewed on purpose', { tag: Tag.REGRESSION }, async ({
  petstore,
}) => {
  const { status, body: live } = await petstore.swagger.get();

  expect(status).toBe(HttpStatus.OK);
  // on a difference the report shows the live contract as "Received" and the pinned copy as "Expected"
  expect(contractOf(live), 'the live swagger differs from schemas/petstore/swagger.json').toEqual(
    contractOf(pinnedPetStoreSwagger),
  );
});
