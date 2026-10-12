// Every API here answers errors with { "message": "..." }.
export interface ApiErrorBody {
  message?: string;
}

// What every service method returns. The body has the success shape (T),
// and negative tests can still read body.message without a cast.
export interface ApiResponse<T> {
  status: number;
  ok: boolean; // status 200-299
  body: T & ApiErrorBody;
  durationMs: number; // time of the last attempt
  attempts: number; // 1, or more if the retry interceptor sent the request again
}
