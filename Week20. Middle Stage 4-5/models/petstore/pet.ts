export type PetStatus = 'available' | 'pending' | 'sold';

export interface NamedRef {
  id: number;
  name: string;
}

// A pet as POST /pet, PUT /pet and GET /pet/{id} send and return it.
// The id is always set by the test: an id made by the server is bigger than
// Number.MAX_SAFE_INTEGER and JavaScript rounds it (see test-data/petstore/petFactory.ts).
export interface Pet {
  id: number;
  name: string;
  photoUrls: string[];
  status?: PetStatus;
  category?: NamedRef;
  tags?: NamedRef[];
}
