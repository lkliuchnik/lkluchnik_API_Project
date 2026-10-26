import { TestInfo } from '@playwright/test';
import { ApiResponse } from '../models/common';
import { HttpStatus } from '../test-data/httpStatus';

// 502, 503, 504: the gateway in front of a public server answered - not the API itself. The
// request never reached the application, so its answer says nothing about the API's rules.
// (A 500 is not here on purpose: it comes from the application and can be a real bug.)
export const GATEWAY_ERRORS: readonly number[] = [
  HttpStatus.BAD_GATEWAY,
  HttpStatus.SERVICE_UNAVAILABLE,
  HttpStatus.GATEWAY_TIMEOUT,
];

// The one rule for "the server is down, the test cannot judge anything": skip the test with
// the reason "infrastructure: <request> answered 502". Used by setupStep and by tests whose
// own request may hit an outage (bulk users, the password table).
export function skipIfGatewayError(testInfo: TestInfo, what: string, status: number) {
  testInfo.skip(GATEWAY_ERRORS.includes(status), `infrastructure: ${what} answered ${status}`);
}

// A request that got no answer because it ran out of time, or the connection broke. Not a
// wrong address ("ENOTFOUND") or a refused connection ("ECONNREFUSED") - those are a wrong
// set-up of the run (environment), and must stay red.
function isOutage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /no response from the server/.test(message) && /Timeout|socket hang up|ECONNRESET/.test(message);
}

// A setup step prepares a test (open an account, read the catalog, create a pet); it is not
// what the test checks. If the server is down at that moment - a gateway error, or no answer
// in time - the test is skipped with the reason "infrastructure: ..." instead of failing:
//   - the run shows the outage as what it is: in the "skipped" column of the run summary,
//     with the reason in the report;
//   - inside a test.fail test, a failed setup would otherwise count as the "expected failure"
//     and hide the outage (Stage 4 review, code-review.txt F2).
// Every other answer is returned as it is - the precondition check of the caller decides.
// Which setup steps use it, and which do not yet: helpers/failure-classification.txt.
export async function setupStep<T>(
  testInfo: TestInfo,
  what: string,
  send: () => Promise<ApiResponse<T>>,
): Promise<ApiResponse<T>> {
  let response: ApiResponse<T>;
  try {
    response = await send();
  } catch (error) {
    testInfo.skip(isOutage(error), `infrastructure: ${what} got no answer in time`);
    throw error;
  }
  skipIfGatewayError(testInfo, what, response.status);
  return response;
}
