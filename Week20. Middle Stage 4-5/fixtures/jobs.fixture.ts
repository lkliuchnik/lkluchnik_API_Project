import { test as base, expect } from './base.fixture';
import { createApiClient } from '../api/createApiClient';
import { JobService } from '../services/jobs/JobService';
import { startJobServer, startWebhookReceiver, WebhookReceiver } from '../mocks/jobServer';

type JobFixtures = {
  jobs: JobService; // the job API of a local job server, started for this test only
  webhooks: WebhookReceiver; // receives the calls the job server makes when a job ends
};

// The job server is a SIMULATION started on this computer (mocks/jobServer.ts) - every test
// gets its own, on a free port, so tests cannot see each other's jobs. No network, no retries:
// the local server does not fail by chance.
export const test = base.extend<JobFixtures>({
  jobs: async ({ request, env, apiLog }, use) => {
    const server = await startJobServer();
    const client = createApiClient(request, { baseUrl: server.url, http: { ...env.http, retries: 0 }, log: apiLog });
    await use(new JobService(client));
    await server.close();
  },

  webhooks: async ({}, use) => {
    const receiver = await startWebhookReceiver();
    await use(receiver);
    await receiver.close();
  },
});

export { expect };
