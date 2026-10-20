import { ApiClient } from '../../api/ApiClient';
import { PetStoreMessage } from '../../models/petstore/message';
import { Pet } from '../../models/petstore/pet';

// Pets of the PetStore. No login: the public server lets everyone read and change pets.
export class PetService {
  constructor(private readonly client: ApiClient) {}

  create(pet: Pet) {
    return this.client.post<Pet & PetStoreMessage>('/pet', { data: pet });
  }

  get(id: number | string) {
    return this.client.get<Pet & PetStoreMessage>(`/pet/${id}`);
  }

  update(pet: Pet) {
    return this.client.put<Pet & PetStoreMessage>('/pet', { data: pet });
  }

  delete(id: number | string) {
    return this.client.delete<PetStoreMessage>(`/pet/${id}`);
  }
}
