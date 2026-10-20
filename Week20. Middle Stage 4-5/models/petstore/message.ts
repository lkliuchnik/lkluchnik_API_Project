// PetStore answers many requests (DELETE, errors, bulk create) with a "message" object,
// for example { "code": 1, "type": "error", "message": "Pet not found" }.
// The "message" field itself comes from ApiErrorBody (models/common.ts), so only code and
// type are added here.
export interface PetStoreMessage {
  code?: number;
  type?: string;
}
