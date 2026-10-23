import { createServer, IncomingMessage, RequestListener, Server, ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import { Job } from '../models/jobs/job';

// A SIMULATION of an asynchronous API, started on this computer by a fixture.
// None of the public APIs of this project has a background job, so this small server plays one:
//   POST /jobs { task, durationMs, fail?, callbackUrl? } -> 202 { id, status: "pending" }
//   GET  /jobs/{id}  -> 200 { id, task, status, result?, error? }
//                       status: pending (first third) -> running -> done | failed
//   when the job ends and callbackUrl was given, the server POSTs the job to it (a webhook).
//   errors: { message }, like DummyJSON - 400 for a bad body, 404 for an unknown job.
// The job time is given by the test, so a test decides how long "later" is.

interface StoredJob {
  id: string;
  task: string;
  startedAt: number;
  durationMs: number;
  fail: boolean;
  callbackUrl?: string;
}

export interface LocalServer {
  url: string; // http://127.0.0.1:<free port>
  close(): Promise<void>;
}

// The state of a job at a moment. The webhook passes the job's end time: a timer may fire
// a millisecond early, and the webhook must always report the final state.
function stateOf(job: StoredJob, now = Date.now()): Job {
  const elapsed = now - job.startedAt;
  const { id, task } = job;
  if (elapsed < job.durationMs / 3) return { id, task, status: 'pending' };
  if (elapsed < job.durationMs) return { id, task, status: 'running' };
  return job.fail
    ? { id, task, status: 'failed', error: `task "${task}" could not be processed` }
    : { id, task, status: 'done', result: `processed: ${task}` };
}

// The longest time a Node timer can wait (about 24.8 days). A longer one fires after 1 ms,
// and the webhook would report "done" while GET still says "pending" - so it is refused.
const MAX_DURATION_MS = 2_147_483_647;

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let text = '';
  for await (const chunk of req) text += chunk;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

// A request handler that never crashes the test process: if it throws (for example the
// client went away while the body was read), the answer is a 500 instead of an unhandled error.
function safe(handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>): RequestListener {
  return (req, res) => {
    handler(req, res).catch((error: Error) => {
      if (!res.headersSent) send(res, 500, { message: `mock server error: ${error.message}` });
      else res.destroy();
    });
  };
}

// starts a server on a free port and returns its address
function listen(server: Server): Promise<LocalServer> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise<void>((done) => server.close(() => done())),
      });
    });
  });
}

export async function startJobServer(): Promise<LocalServer> {
  const jobs = new Map<string, StoredJob>();
  const timers: NodeJS.Timeout[] = [];
  let lastId = 0;

  const server = createServer(
    safe(async (req, res) => {
      const path = new URL(req.url ?? '/', 'http://localhost').pathname; // without a query string

      if (req.method === 'POST' && path === '/jobs') {
        const body = (await readJson(req)) as Partial<StoredJob> | undefined;
        const durationOk =
          typeof body?.durationMs === 'number' && body.durationMs >= 0 && body.durationMs <= MAX_DURATION_MS;
        if (!body || typeof body.task !== 'string' || !durationOk) {
          return send(res, 400, {
            message: `task (text) and durationMs (a number from 0 to ${MAX_DURATION_MS}) are required`,
          });
        }
        const job: StoredJob = {
          id: `job-${++lastId}`,
          task: body.task,
          startedAt: Date.now(),
          durationMs: body.durationMs!,
          fail: body.fail === true,
          callbackUrl: body.callbackUrl,
        };
        jobs.set(job.id, job);
        if (job.callbackUrl) {
          const callbackUrl = job.callbackUrl;
          timers.push(
            setTimeout(() => {
              fetch(callbackUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(stateOf(job, job.startedAt + job.durationMs)),
              }).catch(() => undefined); // nobody listening any more - the test has ended
            }, job.durationMs),
          );
        }
        return send(res, 202, stateOf(job), { Location: `/jobs/${job.id}` });
      }

      const match = /^\/jobs\/([^/]+)$/.exec(path);
      if (req.method === 'GET' && match) {
        const job = jobs.get(match[1]);
        return job ? send(res, 200, stateOf(job)) : send(res, 404, { message: `Job '${match[1]}' not found` });
      }

      send(res, 404, { message: `No endpoint ${req.method} ${path}` });
    }),
  );

  const local = await listen(server);
  return {
    url: local.url,
    close: () => {
      timers.forEach(clearTimeout);
      return local.close();
    },
  };
}

// The other side of a webhook: a tiny server that receives the job the job server POSTs
// when a job ends. waitFor() waits for the call of one job - no polling needed.
// One waitFor per job at a time (enough for the tests).
export interface WebhookReceiver extends LocalServer {
  waitFor(jobId: string, timeoutMs: number): Promise<Job>;
}

export async function startWebhookReceiver(): Promise<WebhookReceiver> {
  const received = new Map<string, Job>();
  const waiting = new Map<string, (job: Job) => void>();
  const timers: NodeJS.Timeout[] = [];

  const server = createServer(
    safe(async (req, res) => {
      const job = (await readJson(req)) as Job | undefined;
      if (job?.id) {
        received.set(job.id, job);
        waiting.get(job.id)?.(job);
      }
      res.writeHead(204).end();
    }),
  );
  const local = await listen(server);

  return {
    url: local.url,
    close: () => {
      timers.forEach(clearTimeout);
      return local.close();
    },
    waitFor: (jobId, timeoutMs) =>
      new Promise<Job>((resolve, reject) => {
        const already = received.get(jobId);
        if (already) return resolve(already);
        const timer = setTimeout(
          () => reject(new Error(`no webhook call for ${jobId} within ${timeoutMs} ms`)),
          timeoutMs,
        );
        timers.push(timer);
        waiting.set(jobId, (job) => {
          clearTimeout(timer);
          resolve(job);
        });
      }),
  };
}
