import { Interceptor } from '../ApiClient';

export interface RetrySettings {
  retries: number; // extra attempts after the first one
  retryDelayMs: number;
}

// "The server is briefly unavailable" - worth one more try.
const RETRY_STATUSES = [502, 503, 504];

// Sends a request again when the server is briefly unavailable:
// - GET:    an answer 502/503/504, or no answer at all (timeout, connection error);
// - DELETE: an answer 502/503/504 only. Deleting twice ends the same way as deleting once
//           (DELETE is idempotent), so a cleanup survives a short outage. Not on "no
//           answer": the first DELETE may have worked, and the second would get a 404.
// Not repeated:
// - other methods - repeating a POST could create the same thing twice;
// - 500 - usually a bug that gives the same answer every time;
// - 4xx - the same request would fail the same way.
export function retryInterceptor(settings: RetrySettings): Interceptor {
  return async (request, next) => {
    if (request.method !== 'GET' && request.method !== 'DELETE') return next(request);

    for (let attempt = 1; ; attempt++) {
      const isLastAttempt = attempt > settings.retries;
      try {
        const response = await next(request);
        if (!RETRY_STATUSES.includes(response.status) || isLastAttempt) {
          return { ...response, attempts: attempt };
        }
      } catch (error) {
        if (isLastAttempt || request.method === 'DELETE') throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, settings.retryDelayMs));
    }
  };
}
