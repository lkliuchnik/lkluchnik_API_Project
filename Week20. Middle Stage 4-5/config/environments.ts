import 'dotenv/config'; // loads .env (if there is one) before the values below are read

// Everything that differs between environments lives here.
// Choose one with TEST_ENV (dev by default): TEST_ENV=staging npx playwright test
// A single value can also be overridden from .env or CI, without changing this file.
// Secrets (passwords) are never written here: they come from environment variables -
// a local .env file (see .env.example) or GitHub Secrets in CI. A password is read only when
// a test logs in to DummyJSON, so tests of the other APIs run without it.

export type EnvironmentName = 'dev' | 'staging';

export interface HttpSettings {
  timeoutMs: number; // how long one request may take
  retries: number; // extra attempts: a GET that got 502/503/504 or no answer, a DELETE that got 502/503/504
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
  petstore: {
    baseUrl: string; // public shared server: tests create their own pets and users with unique ids
  };
  http: HttpSettings;
}

// What the table below holds: everything except the secrets. For a password it holds only the
// name of the variable the password comes from.
type EnvironmentSettings = Omit<Environment, 'dummyjson'> & {
  dummyjson: { baseUrl: string; username: string; passwordVariable: string };
};

// DummyJSON, DemoQA and PetStore have one public server each, so both environments use the same addresses.
// They differ in the test user, the retries and the timeout.
const environments: Record<EnvironmentName, EnvironmentSettings> = {
  dev: {
    name: 'dev',
    dummyjson: { baseUrl: 'https://dummyjson.com', username: 'emilys', passwordVariable: 'DUMMYJSON_PASSWORD_DEV' },
    bookstore: { baseUrl: 'https://demoqa.com', timeoutMs: 30_000 },
    petstore: { baseUrl: 'https://petstore.swagger.io/v2' },
    http: { timeoutMs: 10_000, retries: 0, retryDelayMs: 0, logRequests: true },
  },
  staging: {
    name: 'staging',
    dummyjson: {
      baseUrl: 'https://dummyjson.com',
      username: 'michaelw',
      passwordVariable: 'DUMMYJSON_PASSWORD_STAGING',
    },
    bookstore: { baseUrl: 'https://demoqa.com', timeoutMs: 30_000 },
    petstore: { baseUrl: 'https://petstore.swagger.io/v2' },
    http: { timeoutMs: 15_000, retries: 2, retryDelayMs: 500, logRequests: true },
  },
};

// A secret that must be set. Without it the login fails with a message that names the
// variable and where to set it - every DummyJSON test then shows the same clear
// "environment" failure, and the tests of the other APIs still run.
function secret(variable: string): string {
  const value = process.env[variable];
  if (!value) {
    throw new Error(
      `${variable} is not set. Locally: copy .env.example to .env and fill it in. ` +
        'In CI: add it as a repository secret (Settings > Secrets and variables > Actions).',
    );
  }
  return value;
}

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
      // the user is fixed per environment: its password comes with it (no separate override)
      username: chosen.dummyjson.username,
      get password() {
        return secret(chosen.dummyjson.passwordVariable);
      },
    },
    bookstore: {
      baseUrl: process.env.BOOKSTORE_URL || chosen.bookstore.baseUrl,
      timeoutMs: chosen.bookstore.timeoutMs,
    },
    petstore: {
      baseUrl: process.env.PETSTORE_URL || chosen.petstore.baseUrl,
    },
  };
}

export const env = loadEnvironment();
