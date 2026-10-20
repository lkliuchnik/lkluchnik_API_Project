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

  // The same DELETE with the user name and password (Basic auth) instead of a token. Not in the
  // DemoQA docs, but it works - also for an account that can never get a token (for example a
  // too long password: GenerateToken answers 500). Used by the cleanup as the last way out.
  deleteWithPassword(userId: string, credentials: Credentials) {
    const { userName, password } = loginData(credentials);
    const basic = Buffer.from(`${userName}:${password}`).toString('base64');
    return this.client.delete<BookStoreError>(`/Account/v1/User/${userId}`, {
      headers: { Authorization: `Basic ${basic}` },
    });
  }
}
