import { ApiClient } from '../../api/ApiClient';
import { PetStoreMessage } from '../../models/petstore/message';
import { PetStoreUser } from '../../models/petstore/user';

// PetStore users. createWithArray is the bulk endpoint: many users in one request.
export class PetStoreUserService {
  constructor(private readonly client: ApiClient) {}

  // unknown[]: the partial failure tests put invalid items (null, a wrong type) into the list
  createWithArray(users: unknown[]) {
    return this.client.post<PetStoreMessage>('/user/createWithArray', { data: users });
  }

  get(username: string) {
    return this.client.get<PetStoreUser & PetStoreMessage>(`/user/${encodeURIComponent(username)}`);
  }

  delete(username: string) {
    return this.client.delete<PetStoreMessage>(`/user/${encodeURIComponent(username)}`);
  }
}
