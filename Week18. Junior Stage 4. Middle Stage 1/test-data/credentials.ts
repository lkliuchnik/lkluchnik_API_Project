// The test user from .env. The fallback values are public demo credentials from the DummyJSON docs.
// || and not ??: an empty line like "AUTH_PASSWORD=" in .env also uses the fallback.
export const TEST_USER = {
  username: process.env.AUTH_USERNAME || 'emilys',
  password: process.env.AUTH_PASSWORD || 'emilyspass',
};
