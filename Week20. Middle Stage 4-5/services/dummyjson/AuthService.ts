import { ApiClient } from '../../api/ApiClient';
import { LoginResponse, RefreshResponse } from '../../models/dummyjson/auth';
import { User } from '../../models/dummyjson/user';

export class AuthService {
  constructor(private readonly client: ApiClient) {}

  // expiresInMins: how long the access token lives (DummyJSON default: 60)
  login(username: string, password: string, expiresInMins?: number) {
    return this.client.post<LoginResponse>('/auth/login', { data: { username, password, expiresInMins } });
  }

  refresh(refreshToken: string) {
    return this.client.post<RefreshResponse>('/auth/refresh', { data: { refreshToken } });
  }

  // No token: the auth interceptor adds one (authApi), or the request goes without it (api).
  getCurrentUser(token?: string) {
    return this.client.get<User>('/auth/me', { token });
  }
}
