export type UserRole = 'admin' | 'moderator' | 'user';

// Request body for POST /users/add and PUT /users/{id}.
export interface NewUser {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  age: number;
  role: UserRole;
}

// Only the fields the tests use. DummyJSON returns more.
// A saved user is the same data plus the id the server gives it.
export interface User extends NewUser {
  id: number;
}
