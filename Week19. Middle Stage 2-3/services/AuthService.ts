import { ApiClient } from '../api/ApiClient';
import { LoginResponse } from '../models/auth';
import { User } from '../models/user';

export class AuthService {
  constructor(private readonly client: ApiClient) {}

  login(username: string, password: string) {
    return this.client.post<LoginResponse>('/auth/login', { data: { username, password } });
  }

  getCurrentUser(token: string) {
    return this.client.get<User>('/auth/me', { token });
  }
}
