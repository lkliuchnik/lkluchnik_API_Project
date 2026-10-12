// Answer of POST /auth/login.
export interface LoginResponse {
  id: number;
  username: string;
  email: string;
  accessToken: string;
  refreshToken: string;
}
