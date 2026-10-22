import { test, expect } from '../../fixtures/jobs.fixture';
import { JobStatus } from '../../models/jobs/job';
import { HttpStatus } from '../../test-data/httpStatus';

// Asynchronous operations: the server accepts a job at once (202) and does the work later.
// The client learns the result either by asking again and again (polling) or by being
// called back when the job ends (webhook). The job server is a local SIMULATION
// (mocks/jobServer.ts): no public API of this project has background jobs.
// The real-server example of polling is tokenExpiry.spec.ts (DummyJSON).
//
// Stable on purpose: the test sets how long a job runs, polling has an interval AND a limit,
// and the checks do not depend on how many polls it took or which in-between states a poll
// happened to see - only on the order of the states and on what the job ended as.

const POLL = { intervalMs: 200, timeoutMs: 10_000 };

test.describe('Background jobs - polling', () => {
  test('a job is accepted at once (202) and done later: polling sees it only move forward to done', async ({
    jobs,
  }) => {
    const { status, body: accepted } = await jobs.start({ task: 'resize photos', durationMs: 3_000 });

    expect(status).toBe(HttpStatus.ACCEPTED);
    expect(accepted.status, 'not done yet when the answer comes').toBe('pending');

    const { job, seen } = await jobs.waitUntilFinished(accepted.id, POLL);

    // a slow machine may miss a short state, but a state never comes back after the next one
    const order: JobStatus[] = ['pending', 'running', 'done'];
    expect(seen, 'states in order, each once').toEqual(order.filter((state) => seen.includes(state)));
    expect(seen[seen.length - 1]).toBe('done');
    expect(job).toEqual({ id: accepted.id, task: 'resize photos', status: 'done', result: 'processed: resize photos' });
  });

  test('a job that fails ends as "failed" with a reason - polling stops there too', async ({ jobs }) => {
    const { body: accepted } = await jobs.start({ task: 'broken file', durationMs: 1_000, fail: true });

    const { job } = await jobs.waitUntilFinished(accepted.id, POLL);

    expect(job.status).toBe('failed');
    expect(job.error).toBe('task "broken file" could not be processed');
    expect(job.result).toBeUndefined();
  });

  test('polling has a limit: a job longer than the limit is reported, not waited for', async ({ jobs }) => {
    const { body: accepted } = await jobs.start({ task: 'very long report', durationMs: 60_000 });
    const startedAt = Date.now();

    await expect(jobs.waitUntilFinished(accepted.id, { intervalMs: 200, timeoutMs: 1_000 })).rejects.toThrow(
      /^job job-\d+ is still "(pending|running)" after 1000 ms \(\d+ polls\)$/,
    );
    expect(Date.now() - startedAt, 'gave up near the limit, did not wait for the job').toBeLessThan(3_000);
  });

  test('an unknown job id is answered with 404, not with an endless "pending"', async ({ jobs }) => {
    const { status, body } = await jobs.get('job-999');

    expect(status).toBe(HttpStatus.NOT_FOUND);
    expect(body).toEqual({ message: "Job 'job-999' not found" });
  });
});

test.describe('Background jobs - webhook', () => {
  test('the server calls back when the job ends, with the same result polling would show', async ({
    jobs,
    webhooks,
  }) => {
    const { body: accepted } = await jobs.start({
      task: 'send newsletter',
      durationMs: 1_000,
      callbackUrl: webhooks.url,
    });

    // no polling: the test simply waits for the call (and has a limit for that, too)
    const called = await webhooks.waitFor(accepted.id, 5_000);

    expect(called).toEqual({ id: accepted.id, task: 'send newsletter', status: 'done', result: 'processed: send newsletter' });
    const { body: now } = await jobs.get(accepted.id);
    expect(now).toEqual(called);
  });
});
