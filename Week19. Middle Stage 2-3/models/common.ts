// DummyJSON answers every error with { "message": "..." }.
export interface ApiErrorBody {
  message?: string;
}

// What every service method returns. The body has the success shape (T),
// and negative tests can still read body.message without a cast.
export interface ApiResponse<T> {
  status: number;
  body: T & ApiErrorBody;
}

// Pagination fields that every DummyJSON list has.
export interface Page {
  total: number;
  skip: number;
  limit: number;
}
