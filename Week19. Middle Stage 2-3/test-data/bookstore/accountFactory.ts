import { randomUUID } from 'crypto';
import { Credentials } from '../../models/bookstore/account';

// New, unique login data for a DemoQA account.
// The password meets the DemoQA rules: 8+ characters, an upper and a lower case letter,
// a digit and a special character.
export function buildCredentials(overrides: Partial<Credentials> = {}): Credentials {
  const unique = randomUUID().slice(0, 8);
  return {
    userName: `qa_${unique}`,
    password: `Qa!${unique}9z`,
    ...overrides,
  };
}
