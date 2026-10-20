import { expect, test } from '@playwright/test';
import { ApiResponse } from '../../models/common';
import { BookStoreError } from '../../models/bookstore/account';

// A DemoQA error answer: the expected status and a JSON body of exactly { code, message },
// for example 400 { "code": "1205", "message": "ISBN supplied is not available in Books Collection!" }.
// An HTML error page fails here: the client turns it into { message: "<!DOCTYPE html>..." } - no code.
// Leave out "code" when the test only knows that it must be a proper error, not which one.
// box: true - a failure is reported at the line in the test that called this function.
export async function expectBookStoreError(
  response: ApiResponse<BookStoreError>,
  expected: { status: number; code?: string; message?: string },
) {
  await test.step(
    `DemoQA error ${expected.status}${expected.code ? ` code ${expected.code}` : ''}`,
    async () => {
      expect(response.status, 'status').toBe(expected.status);
      expect(response.body, 'body is { code, message }').toEqual({
        code: expected.code ?? expect.any(String),
        message: expected.message ?? expect.any(String),
      });
    },
    { box: true },
  );
}
