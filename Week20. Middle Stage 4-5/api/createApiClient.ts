import { APIRequestContext } from '@playwright/test';
import { HttpSettings } from '../config/environments';
import { ApiClient, Interceptor } from './ApiClient';
import { loggingInterceptor } from './interceptors/logging';
import { retryInterceptor } from './interceptors/retry';

const JSON_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' };

// Builds a client the way every API in this project uses it: JSON headers, the timeout and
// retries of the environment, and the request log. The fixture file of each API calls this,
// so all APIs get the same behaviour. Order: auth (if given) -> retry -> logging, so every
// real request - also a retry or a request with a refreshed token - is one line in the log.
export function createApiClient(
  request: APIRequestContext,
  settings: { baseUrl: string; http: HttpSettings; log: string[]; auth?: Interceptor },
) {
  const { baseUrl, http, log, auth } = settings;
  return new ApiClient(request, {
    baseUrl,
    defaultHeaders: JSON_HEADERS,
    timeoutMs: http.timeoutMs,
    interceptors: [
      ...(auth ? [auth] : []),
      retryInterceptor(http),
      ...(http.logRequests ? [loggingInterceptor((line) => log.push(line))] : []),
    ],
  });
}
