import 'dotenv/config'; // loads .env (if there is one) before the values below are read

// Everything that differs between environments lives here.
// Choose one with TEST_ENV (dev by default): TEST_ENV=staging npx playwright test
// A single value can also be overridden from .env or CI, without changing this file.

export type EnvironmentName = 'dev' | 'staging';

export interface HttpSettings {
  timeoutMs: number; // how long one request may take
  retries: number; // extra attempts for a GET that got 502/503/504 or no answer
  retryDelayMs: number; // pause before each extra attempt
  logRequests: boolean; // write every request to the test report
}

export interface Environment {
  name: EnvironmentName;
  dummyjson: {
    baseUrl: string;
    username: string;
    password: string;
  };
  bookstore: {
    baseUrl: string; // no fixed user: tests open their own accounts
    timeoutMs: number; // DemoQA logins (GenerateToken) can take 7 s, longer than other APIs
  };
  http: HttpSettings;
}

// DummyJSON and DemoQA have one public server each, so both environments use the same addresses.
// They differ in the test user, the retries and the timeout.
const environments: Record<EnvironmentName, Environment> = {
  dev: {
    name: 'dev',
    dummyjson: { baseUrl: 'https://dummyjson.com', username: 'emilys', password: 'emilyspass' },
    bookstore: { baseUrl: 'https://demoqa.com', timeoutMs: 30_000 },
    http: { timeoutMs: 10_000, retries: 0, retryDelayMs: 0, logRequests: true },
  },
  staging: {
    name: 'staging',
    dummyjson: { baseUrl: 'https://dummyjson.com', username: 'michaelw', password: 'michaelwpass' },
    bookstore: { baseUrl: 'https://demoqa.com', timeoutMs: 30_000 },
    http: { timeoutMs: 15_000, retries: 2, retryDelayMs: 500, logRequests: true },
  },
};

function loadEnvironment(): Environment {
  const name = process.env.TEST_ENV || 'dev';
  const known = Object.keys(environments); // own names only - "constructor" is not an environment
  if (!known.includes(name)) {
    throw new Error(`Unknown TEST_ENV "${name}". Use one of: ${known.join(', ')}`);
  }
  const chosen = environments[name as EnvironmentName];

  return {
    ...chosen,
    dummyjson: {
      baseUrl: process.env.DUMMYJSON_URL || chosen.dummyjson.baseUrl,
      username: process.env.DUMMYJSON_USERNAME || chosen.dummyjson.username,
      password: process.env.DUMMYJSON_PASSWORD || chosen.dummyjson.password,
    },
    bookstore: {
      baseUrl: process.env.BOOKSTORE_URL || chosen.bookstore.baseUrl,
      timeoutMs: chosen.bookstore.timeoutMs,
    },
  };
}

export const env = loadEnvironment();
