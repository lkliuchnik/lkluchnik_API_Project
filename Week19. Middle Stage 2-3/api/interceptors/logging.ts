import { Interceptor } from '../ApiClient';

// Writes one line per request that really went to the server, for example
//   GET /auth/me -> 401 (212 ms) [token]
// Put it last in the list, so retries and token refreshes show up as separate lines.
export function loggingInterceptor(log: (line: string) => void): Interceptor {
  return async (request, next) => {
    const query = request.options.params ? '?' + new URLSearchParams(toStrings(request.options.params)) : '';
    const token = request.options.token !== undefined ? ' [token]' : '';
    const line = `${request.method} ${request.path}${query}`;

    try {
      const response = await next(request);
      log(`${line} -> ${response.status} (${response.durationMs} ms)${token}`);
      return response;
    } catch (error) {
      log(`${line} -> no response${token}`);
      throw error;
    }
  };
}

function toStrings(params: Record<string, number | string>) {
  return Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)]));
}
