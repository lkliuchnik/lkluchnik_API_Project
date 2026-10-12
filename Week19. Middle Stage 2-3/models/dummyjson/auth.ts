// Answer of POST /auth/login.
export interface LoginResponse {
  id: number;
  username: string;
  email: string;
  accessToken: string;
  refreshToken: string;
}

// Answer of POST /auth/refresh: the two tokens, like the login answer.
export type RefreshResponse = Pick<LoginResponse, 'accessToken' | 'refreshToken'>;
