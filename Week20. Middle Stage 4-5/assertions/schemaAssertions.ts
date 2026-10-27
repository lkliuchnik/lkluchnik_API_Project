import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { expect, test } from '@playwright/test';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// Schema validation: does an answer have the agreed shape - the fields, their types, the
// allowed values? The schemas live in schemas/ as JSON files, one per answer, and are loaded
// here by their "$id" - a new *.schema.json file in any folder of schemas/ is available at once.
//   schemas/petstore/swagger.json   the PetStore's own published contract (a pinned copy);
//                                   its definitions are used as "petstore/swagger#/definitions/Pet" etc.
//   schemas/<api>/*.schema.json     practical schemas we keep ourselves: the fields the tests
//                                   rely on. New fields are allowed - only a missing, retyped or
//                                   wrongly valued field fails. Why: helpers/schema-changes.txt.
//
// The check is an explicit step in a test, never hidden in the client: a negative test must
// still see an error answer, and a test.fail must not "pass" because of a schema error.

const SCHEMAS = join(__dirname, '..', 'schemas');

// The pinned copy of the PetStore contract - also compared with the live one (petstore/schemas.spec.ts)
export const pinnedPetStoreSwagger = JSON.parse(readFileSync(join(SCHEMAS, 'petstore', 'swagger.json'), 'utf8'));

const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv); // date-time, uuid, email ...
// Swagger 2.0 formats and keywords that JSON Schema does not have
ajv.addFormat('int32', { type: 'number', validate: (n: number) => Number.isInteger(n) && n >= -(2 ** 31) && n < 2 ** 31 });
ajv.addFormat('int64', { type: 'number', validate: (n: number) => Number.isInteger(n) });
ajv.addKeyword({ keyword: 'xml' }); // how the type looks in XML - not about JSON
ajv.addKeyword({ keyword: 'example' }); // a sample value for the documentation

ajv.addSchema({ $id: 'petstore/swagger', definitions: pinnedPetStoreSwagger.definitions });
for (const folder of readdirSync(SCHEMAS, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
  for (const file of readdirSync(join(SCHEMAS, folder.name)).filter((name) => name.endsWith('.schema.json'))) {
    ajv.addSchema(JSON.parse(readFileSync(join(SCHEMAS, folder.name, file), 'utf8')));
  }
}

// Checks that a value matches the schema with this id, for example 'dummyjson/cart' or
// 'petstore/swagger#/definitions/Pet'. On failure the report lists every place that does not match,
// in a readable form: "/products/0/price: must be number".
// box: true - a failure is reported at the line in the test that called this function.
export async function expectSchema(value: unknown, schemaId: string) {
  await test.step(
    `matches the schema ${schemaId}`,
    async () => {
      const validate = ajv.getSchema(schemaId);
      if (!validate) throw new Error(`No schema "${schemaId}" in schemas/`);
      validate(value);
      const problems = (validate.errors ?? []).map((e) => `${e.instancePath || '(the whole answer)'}: ${e.message}`);
      expect(problems, `the answer does not match ${schemaId}`).toEqual([]);
    },
    { box: true },
  );
}
