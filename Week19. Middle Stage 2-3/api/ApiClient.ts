import { APIRequestContext, APIResponse } from '@playwright/test';
import { ApiErrorBody, ApiResponse } from '../models/common';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface RequestOptions {
  token?: string; // sent as "Authorization: Bearer <token>"; no token = no header
  data?: unknown; // JSON body
  params?: Record<string, number | string>; // query string
}

// The only place that sends HTTP requests. Knows the base URL, adds the auth header
// and turns every answer into { status, body }. Does NOT decide what is right or
// wrong: a 401 or 404 is returned like a 200, because negative tests need it.
export class ApiClient {
  private readonly baseUrl: string;

  constructor(
    private readonly request: APIRequestContext,
    baseUrl: string,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, ''); // "https://dummyjson.com/" works the same as without "/"
  }

  get<T>(path: string, options?: RequestOptions) {
    return this.send<T>('GET', path, options);
  }

  post<T>(path: string, options?: RequestOptions) {
    return this.send<T>('POST', path, options);
  }

  put<T>(path: string, options?: RequestOptions) {
    return this.send<T>('PUT', path, options);
  }

  delete<T>(path: string, options?: RequestOptions) {
    return this.send<T>('DELETE', path, options);
  }

  private async send<T>(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const url = this.baseUrl + path;
    // only "no token" means no header; an empty string is sent as it is
    const headers: Record<string, string> =
      options.token !== undefined ? { Authorization: `Bearer ${options.token}` } : {};

    let response: APIResponse;
    try {
      response = await this.request.fetch(url, { method, headers, data: options.data, params: options.params });
    } catch (error) {
      // no answer at all (DNS, timeout, connection refused)
      throw new Error(`${method} ${path} - no response from the server: ${(error as Error).message}`);
    }

    // the one place where we trust the server: the body is not validated, only typed
    const body = (await this.readBody(response)) as T & ApiErrorBody;
    return { status: response.status(), body };
  }

  // Never throws: the test must always get the status. A throw here would also count as
  // "the expected failure" in a test.fail() test and hide a real change of the API.
  private async readBody(response: APIResponse): Promise<unknown> {
    const text = await response.text();
    if (!text) return {}; // e.g. 204 No Content
    try {
      return JSON.parse(text);
    } catch {
      return { message: text }; // plain-text or HTML error page
    }
  }
}
