import { randomUUID } from 'crypto';
import { NewUser } from '../../models/dummyjson/user';

// Returns new user data with a unique username and email on every call.
// Example: buildUser({ role: 'admin' }) - an admin, everything else default.
export function buildUser(overrides: Partial<NewUser> = {}): NewUser {
  const unique = randomUUID().slice(0, 8);
  return {
    firstName: 'Test',
    lastName: 'User',
    username: `qa_user_${unique}`,
    email: `qa_user_${unique}@example.com`,
    age: 30,
    role: 'user',
    ...overrides,
  };
}
