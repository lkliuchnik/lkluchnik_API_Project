export interface UserPayload {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  age: number;
}

// Returns new user data with a unique username and email on every call.
export function buildUser(overrides: Partial<UserPayload> = {}): UserPayload {
  const unique = Date.now();
  return {
    firstName: 'Test',
    lastName: 'User',
    username: `qa_user_${unique}`,
    email: `qa_user_${unique}@example.com`,
    age: 30,
    ...overrides,
  };
}
