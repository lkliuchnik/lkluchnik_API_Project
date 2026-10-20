import { ApiClient } from '../../api/ApiClient';
import {
  Account,
  BookStoreError,
  CreatedAccount,
  Credentials,
  LoginResponse,
  TokenResponse,
} from '../../models/bookstore/account';

// Only the user name and password go to the server - also when a test passes a whole reader
// (with userId and session): TypeScript allows that, and the extra fields would be sent too.
function loginData({ userName, password }: Credentials): Credentials {
  return { userName, password };
}

export class AccountService {
  constructor(private readonly client: ApiClient) {}

  create(credentials: Credentials) {
    return this.client.post<CreatedAccount & BookStoreError>('/Account/v1/User', {
      data: loginData(credentials),
    });
  }

  generateToken(credentials: Credentials) {
    return this.client.post<TokenResponse>('/Account/v1/GenerateToken', { data: loginData(credentials) });
  }

  // returns the account's current token; does not create a new one
  login(credentials: Credentials) {
    return this.client.post<LoginResponse>('/Account/v1/Login', { data: loginData(credentials) });
  }

  // true once the reader has generated a token
  isAuthorized(credentials: Credentials) {
    return this.client.post<boolean>('/Account/v1/Authorized', { data: loginData(credentials) });
  }

  // No token: the auth interceptor adds one (readerApi), or the request goes without it.
  getUser(userId: string, token?: string) {
    return this.client.get<Account & BookStoreError>(`/Account/v1/User/${userId}`, { token });
  }

  delete(userId: string, token?: string) {
    return this.client.delete<BookStoreError>(`/Account/v1/User/${userId}`, { token });
  }
}
