import { expect, test } from '@playwright/test';
import { ApiResponse } from '../../models/common';

// A DummyJSON error answer: the expected status and a JSON body of exactly { message },
// for example 404 { "message": "Product with id '99999' not found" }.
// An HTML page fails here: the client turns it into { message: "<!DOCTYPE html>..." }, so the
// message is also checked to be plain text, not a page.
// box: true - a failure is reported at the line in the test that called this function.
export async function expectDummyJsonError(response: ApiResponse<unknown>, expected: { status: number; message?: string }) {
  await test.step(
    `DummyJSON error ${expected.status}`,
    async () => {
      expect(response.status, 'status').toBe(expected.status);
      expect(response.body, 'body is { message }').toEqual({ message: expected.message ?? expect.any(String) });
      expect(response.body.message, 'message is text, not an HTML page').not.toMatch(/^\s*</);
    },
    { box: true },
  );
}
