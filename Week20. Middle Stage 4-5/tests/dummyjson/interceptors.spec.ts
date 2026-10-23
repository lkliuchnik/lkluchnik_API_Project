import { APIRequestContext } from '@playwright/test';
import { test, expect } from '../../fixtures/dummyjson.fixture';
import { ApiClient, Interceptor } from '../../api/ApiClient';
import { authInterceptor, TokenSource } from '../../api/interceptors/auth';
import { loggingInterceptor } from '../../api/interceptors/logging';
import { retryInterceptor } from '../../api/interceptors/retry';
import { AuthService } from '../../services/dummyjson/AuthService';
import { HttpStatus } from '../../test-data/httpStatus';

// These tests build their own small clients with fixed settings, so the result does not
// depend on the environment (dev has no retries, staging has 2). Each test shows which
// interceptors its client has. DummyJSON /http/{status} answers with any status we ask for.

const fastRetry = () => retryInterceptor({ retries: 2, retryDelayMs: 100 });

function makeClient(request: APIRequestContext, baseUrl: string, interceptors: Interceptor[]) {
  return new ApiClient(request, { baseUrl, interceptors });
}

test.describe('Retry interceptor', () => {
  test('a GET that keeps getting 503 is sent 3 times (1 + 2 retries), then the 503 is returned', async ({
    request,
    env,
  }) => {
    const log: string[] = [];
    const client = makeClient(request, env.dummyjson.baseUrl, [fastRetry(), loggingInterceptor((l) => log.push(l))]);

    const response = await client.get('/http/503');

    expect(response.status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect(response.attempts).toBe(3);
    expect(log).toHaveLength(3); // three real requests went to the server
  });

  test('a GET that gets 500 is not sent again - a server bug answers the same way', async ({ request, env }) => {
    const log: string[] = [];
    const client = makeClient(request, env.dummyjson.baseUrl, [fastRetry(), loggingInterceptor((l) => log.push(l))]);

    const response = await client.get('/http/500');

    expect(response.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(response.attempts).toBe(1);
    expect(log).toHaveLength(1);
  });

  test('a GET that gets 404 is not sent again - the same request would fail the same way', async ({ request, env }) => {
    const log: string[] = [];
    const client = makeClient(request, env.dummyjson.baseUrl, [fastRetry(), loggingInterceptor((l) => log.push(l))]);

    const response = await client.get('/http/404');

    expect(response.status).toBe(HttpStatus.NOT_FOUND);
    expect(response.attempts).toBe(1);
    expect(log).toHaveLength(1);
  });

  test('a POST that gets 503 is not sent again', async ({ request, env }) => {
    const log: string[] = [];
    const client = makeClient(request, env.dummyjson.baseUrl, [fastRetry(), loggingInterceptor((l) => log.push(l))]);

    const response = await client.post('/http/503');

    expect(response.status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect(response.attempts).toBe(1);
    expect(log).toHaveLength(1);
  });

  test('a GET that gets no answer at all is tried 3 times, then the error is thrown', async ({ request }) => {
    const log: string[] = [];
    // nothing listens on this port: the connection is refused (at once on Linux, ~2 s per try on Windows)
    const client = makeClient(request, 'http://127.0.0.1:1', [fastRetry(), loggingInterceptor((l) => log.push(l))]);

    await expect(client.get('/products/1')).rejects.toThrow('GET /products/1 - no response from the server');
    expect(log).toEqual(Array(3).fill('GET /products/1 -> no response'));
  });

  test('a DELETE that keeps getting 503 is sent 3 times - deleting twice changes nothing', async ({ request, env }) => {
    const log: string[] = [];
    const client = makeClient(request, env.dummyjson.baseUrl, [fastRetry(), loggingInterceptor((l) => log.push(l))]);

    const response = await client.delete('/http/503');

    expect(response.status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect(response.attempts).toBe(3);
    expect(log).toHaveLength(3);
  });

  test('a DELETE that gets no answer at all is not sent again - the first one may have worked', async ({
    request,
  }) => {
    const log: string[] = [];
    const client = makeClient(request, 'http://127.0.0.1:1', [fastRetry(), loggingInterceptor((l) => log.push(l))]);

    await expect(client.delete('/products/1')).rejects.toThrow('DELETE /products/1 - no response from the server');
    expect(log).toEqual(['DELETE /products/1 -> no response']);
  });

  test('a GET that succeeds is sent once', async ({ request, env }) => {
    const client = makeClient(request, env.dummyjson.baseUrl, [fastRetry()]);

    const response = await client.get('/products/1');

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.attempts).toBe(1);
  });
});

test.describe('Auth interceptor', () => {
  test('adds the token: GET /auth/me works without passing a token', async ({ request, env, session }) => {
    const log: string[] = [];
    const client = makeClient(request, env.dummyjson.baseUrl, [
      authInterceptor(session),
      loggingInterceptor((l) => log.push(l)),
    ]);

    const { status, body } = await new AuthService(client).getCurrentUser();

    expect(status).toBe(HttpStatus.OK);
    expect(body.username).toBe(env.dummyjson.username);
    expect(log).toEqual([expect.stringMatching(/^GET \/auth\/me -> 200 .*\[token\]$/)]);
  });

  test('a rejected token is refreshed once, and the request is sent again', async ({ request, env, session }) => {
    await session.getToken(); // log in, so the session has a real refresh token

    // a token source whose current token the server rejects
    let refreshes = 0;
    const staleTokens: TokenSource = {
      getToken: async () => 'stale-token',
      refresh: async () => {
        refreshes++;
        return session.refresh();
      },
    };
    const log: string[] = [];
    const client = makeClient(request, env.dummyjson.baseUrl, [
      authInterceptor(staleTokens),
      loggingInterceptor((l) => log.push(l)),
    ]);

    const { status, body } = await new AuthService(client).getCurrentUser();

    expect(status).toBe(HttpStatus.OK);
    expect(body.username).toBe(env.dummyjson.username);
    expect(refreshes).toBe(1);
    expect(log).toEqual([
      expect.stringMatching(/^GET \/auth\/me -> 401 /), // the stale token
      expect.stringMatching(/^GET \/auth\/me -> 200 /), // the refreshed token
    ]);
  });

  test('if no new token can be got, the test gets the 401 - not an exception', async ({ request, env }) => {
    const noNewToken: TokenSource = {
      getToken: async () => 'stale-token',
      refresh: async () => {
        throw new Error('the refresh token was rejected');
      },
    };
    const client = makeClient(request, env.dummyjson.baseUrl, [authInterceptor(noNewToken)]);

    const { status, body } = await new AuthService(client).getCurrentUser();

    expect(status).toBe(HttpStatus.UNAUTHORIZED);
    expect(body.message).toBe('Invalid/Expired Token!');
  });

  test('a token passed by the test is left alone, even a wrong one', async ({ authApi }) => {
    const { status, body } = await authApi.products.getProtectedPage(5, 'not-a-real-token');

    expect(status).toBe(HttpStatus.UNAUTHORIZED);
    expect(body.message).toBe('Invalid/Expired Token!');
  });
});

test.describe('Logging interceptor', () => {
  test('writes the method, the path with its query, the status and the time', async ({ request, env }) => {
    const log: string[] = [];
    const client = makeClient(request, env.dummyjson.baseUrl, [loggingInterceptor((l) => log.push(l))]);

    await client.get('/products', { params: { limit: 1, skip: 0 } });

    expect(log).toHaveLength(1);
    expect(log[0]).toMatch(/^GET \/products\?limit=1&skip=0 -> 200 \(\d+ ms\)$/);
  });
});
