import { ApiRequest, Interceptor } from '../ApiClient';

// Where the auth interceptor gets tokens from. Each API has its own way to log in,
// so each API brings its own TokenSource (for DummyJSON: services/dummyjson/DummyJsonSession).
export interface TokenSource {
  getToken(): Promise<string>; // the current token (logs in the first time; throws if login fails)
  refresh(): Promise<string>; // a new token, after the server rejected the old one
}

// Adds "Authorization: Bearer <token>" to every request that does not bring its own token.
// If the server answers 401, it gets a new token ONCE and sends the request again.
// If no new token can be got, the first 401 is returned - a status, not an exception.
// A request with its own token (even '') is left alone: tests about tokens need full control.
export function authInterceptor(tokens: TokenSource): Interceptor {
  return async (request, next) => {
    if (request.options.token !== undefined) return next(request);

    const response = await next(withToken(request, await tokens.getToken()));
    if (response.status !== 401) return response;

    let newToken: string;
    try {
      newToken = await tokens.refresh();
    } catch {
      return response;
    }
    return next(withToken(request, newToken));
  };
}

function withToken(request: ApiRequest, token: string): ApiRequest {
  return { ...request, options: { ...request.options, token } };
}
