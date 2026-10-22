import { ApiClient } from '../../api/ApiClient';
import { PetStoreMessage } from '../../models/petstore/message';

// Orders of the PetStore. Only what the error consistency tests need: read and delete by id.
export class StoreService {
  constructor(private readonly client: ApiClient) {}

  getOrder(id: number) {
    return this.client.get<PetStoreMessage>(`/store/order/${id}`);
  }

  deleteOrder(id: number) {
    return this.client.delete<PetStoreMessage>(`/store/order/${id}`);
  }
}
