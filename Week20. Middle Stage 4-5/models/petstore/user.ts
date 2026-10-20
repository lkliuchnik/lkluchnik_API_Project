// A PetStore user as POST /user, POST /user/createWithArray and GET /user/{username} use it.
// Only id and username are needed; the server stores whatever else is sent.
export interface PetStoreUser {
  id: number;
  username: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  phone?: string;
  userStatus?: number;
}
