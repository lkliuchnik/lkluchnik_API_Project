import { ApiClient } from '../../api/ApiClient';
import { PetStoreMessage } from '../../models/petstore/message';
import { Order } from '../../models/petstore/order';

// Orders of the PetStore: create, read and delete by id.
export class StoreService {
  constructor(private readonly client: ApiClient) {}

  createOrder(order: Order) {
    return this.client.post<Order & PetStoreMessage>('/store/order', { data: order });
  }

  getOrder(id: number) {
    return this.client.get<Order & PetStoreMessage>(`/store/order/${id}`);
  }

  deleteOrder(id: number) {
    return this.client.delete<PetStoreMessage>(`/store/order/${id}`);
  }
}
