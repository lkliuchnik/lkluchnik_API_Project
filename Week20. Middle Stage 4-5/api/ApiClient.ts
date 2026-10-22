import { APIRequestContext, APIResponse } from '@playwright/test';
import { ApiErrorBody, ApiResponse } from '../models/common';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface RequestOptions {
  token?: string; // sent as "Authorization: Bearer <token>"; no token = no header
  headers?: Record<string, string>; // any other header (an API key, a cookie...)
  data?: unknown; // JSON body
  multipart?: FormData; // multipart/form-data body (fields and files) instead of JSON
  params?: Record<string, number | string>; // query string
}

// One request on its way through the interceptors.
export interface ApiRequest {
  method: HttpMethod;
  path: string;
  options: RequestOptions;
}

// An interceptor gets the request and "next" - the rest of the chain. It may change the
// request, call next once or several times, and look at (or change) the answer.
export type SendFn = (request: ApiRequest) => Promise<ApiResponse<unknown>>;
export type Interceptor = (request: ApiRequest, next: SendFn) => Promise<ApiResponse<unknown>>;

export interface ApiClientOptions {
  baseUrl: string;
  defaultHeaders?: Record<string, string>; // sent with every request of this client
  timeoutMs?: number;
  interceptors?: Interceptor[]; // the first one sees the request first and the answer last
}

// The only place that sends HTTP requests. Knows the base URL and the headers, turns every
// answer into { status, ok, body, ... } and runs the interceptors. Does NOT decide what is
// right or wrong: a 401 or 404 is returned like a 200, because negative tests need it.
export class ApiClient {
  private readonly baseUrl: string;
  private readonly chain: SendFn;

  constructor(
    private readonly request: APIRequestContext,
    private readonly options: ApiClientOptions,
  ) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, ''); // "https://x.com/" works the same as without "/"

    const sendOnce: SendFn = (req) => this.sendOnce(req);
    this.chain = (options.interceptors ?? []).reduceRight<SendFn>(
      (next, interceptor) => (req) => interceptor(req, next),
      sendOnce,
    );
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

  private async send<T>(method: HttpMethod, path: string, options: RequestOptions = {}) {
    // the one place where we trust the server: the body is not validated, only typed
    return (await this.chain({ method, path, options })) as ApiResponse<T>;
  }

  private async sendOnce(req: ApiRequest): Promise<ApiResponse<unknown>> {
    const { token, data, params, multipart } = req.options;
    const headers: Record<string, string> = { ...this.options.defaultHeaders, ...req.options.headers };
    // a multipart body needs "multipart/form-data; boundary=..." - Playwright writes that header
    // itself, so the JSON Content-Type of the client must not be sent with it
    if (multipart) delete headers['Content-Type'];
    // only "no token" means no header; an empty string is sent as it is
    if (token !== undefined) headers.Authorization = `Bearer ${token}`;

    const startedAt = Date.now();
    let response: APIResponse;
    try {
      response = await this.request.fetch(this.baseUrl + req.path, {
        method: req.method,
        headers,
        data,
        multipart,
        params,
        timeout: this.options.timeoutMs,
      });
    } catch (error) {
      // no answer at all (DNS, timeout, connection refused)
      throw new Error(`${req.method} ${req.path} - no response from the server: ${(error as Error).message}`);
    }

    return {
      status: response.status(),
      ok: response.ok(),
      body: (await readBody(response)) as ApiErrorBody,
      durationMs: Date.now() - startedAt,
      attempts: 1,
    };
  }
}

// Never throws: the test must always get the status. A throw here would also count as
// "the expected failure" in a test.fail() test and hide a real change of the API.
async function readBody(response: APIResponse): Promise<unknown> {
  const text = await response.text();
  if (!text) return {}; // e.g. 204 No Content
  try {
    return JSON.parse(text);
  } catch {
    return { message: text }; // plain-text or HTML error page
  }
}
