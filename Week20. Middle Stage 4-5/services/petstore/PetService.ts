import { ApiClient } from '../../api/ApiClient';
import { PetStoreMessage } from '../../models/petstore/message';
import { Pet } from '../../models/petstore/pet';

// Pets of the PetStore. No login: the public server lets everyone read and change pets.
export class PetService {
  constructor(private readonly client: ApiClient) {}

  create(pet: Pet) {
    return this.client.post<Pet & PetStoreMessage>('/pet', { data: pet });
  }

  // Sends the body as given - for negative tests. A Buffer goes byte for byte (not valid JSON).
  createRaw(body: unknown) {
    return this.client.post<Pet & PetStoreMessage>('/pet', { data: body });
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

  // multipart/form-data: the fields "file" (the image) and "additionalMetadata" (a description).
  // The test builds the form, so a negative test can leave a field out or name it wrongly.
  uploadImage(id: number | string, form: FormData) {
    return this.client.post<PetStoreMessage>(`/pet/${id}/uploadImage`, { multipart: form });
  }

  // the same endpoint with a JSON body instead of a form - for the negative test
  uploadImageAsJson(id: number | string, body: unknown) {
    return this.client.post<PetStoreMessage>(`/pet/${id}/uploadImage`, { data: body });
  }
}
