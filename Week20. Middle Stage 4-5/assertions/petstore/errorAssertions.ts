import { expect, test } from '@playwright/test';
import { ApiResponse } from '../../models/common';

// A PetStore error answer: the expected status and a JSON body of exactly
// { code: number, type: string, message: string } - the "ApiResponse" object of the
// PetStore swagger, for example 404 { "code": 1, "type": "error", "message": "Pet not found" }.
// An empty body fails here: the client turns it into {}.
// box: true - a failure is reported at the line in the test that called this function.
export async function expectPetStoreError(
  response: ApiResponse<unknown>, // any answer: an error must look like this whatever the endpoint
  expected: { status: number },
) {
  await test.step(
    `PetStore error ${expected.status}`,
    async () => {
      expect(response.status, 'status').toBe(expected.status);
      expect(response.body, 'body is { code, type, message }').toEqual({
        code: expect.any(Number),
        type: expect.any(String),
        message: expect.any(String),
      });
    },
    { box: true },
  );
}
