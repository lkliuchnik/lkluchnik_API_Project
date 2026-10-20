import { Interceptor } from '../ApiClient';

export interface RetrySettings {
  retries: number; // extra attempts after the first one
  retryDelayMs: number;
}

// "The server is briefly unavailable" - worth one more try.
const RETRY_STATUSES = [502, 503, 504];

// Sends a GET again when the server is briefly unavailable: an answer 502/503/504, or no
// answer at all (timeout, connection error). Not repeated:
// - other methods - repeating a POST could create the same thing twice;
// - 500 - usually a bug that gives the same answer every time;
// - 4xx - the same request would fail the same way.
export function retryInterceptor(settings: RetrySettings): Interceptor {
  return async (request, next) => {
    if (request.method !== 'GET') return next(request);

    for (let attempt = 1; ; attempt++) {
      const isLastAttempt = attempt > settings.retries;
      try {
        const response = await next(request);
        if (!RETRY_STATUSES.includes(response.status) || isLastAttempt) {
          return { ...response, attempts: attempt };
        }
      } catch (error) {
        if (isLastAttempt) throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, settings.retryDelayMs));
    }
  };
}
