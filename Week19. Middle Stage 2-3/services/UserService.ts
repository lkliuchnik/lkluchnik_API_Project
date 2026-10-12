import { ApiClient } from '../api/ApiClient';
import { NewUser, User } from '../models/user';

export class UserService {
  constructor(private readonly client: ApiClient) {}

  getById(id: number) {
    return this.client.get<User>(`/users/${id}`);
  }

  add(user: NewUser) {
    return this.client.post<User>('/users/add', { data: user });
  }

  update(id: number, fields: Partial<NewUser>) {
    return this.client.put<User>(`/users/${id}`, { data: fields });
  }
}
