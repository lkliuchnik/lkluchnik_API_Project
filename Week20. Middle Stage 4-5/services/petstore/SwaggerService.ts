import { ApiClient } from '../../api/ApiClient';

// The PetStore's published contract: GET /swagger.json (Swagger 2.0).
// Only the parts the contract check compares are typed here.
export interface SwaggerContract {
  swagger: string;
  paths: Record<string, unknown>;
  definitions: Record<string, unknown>;
}

export class SwaggerService {
  constructor(private readonly client: ApiClient) {}

  get() {
    return this.client.get<SwaggerContract>('/swagger.json');
  }
}
