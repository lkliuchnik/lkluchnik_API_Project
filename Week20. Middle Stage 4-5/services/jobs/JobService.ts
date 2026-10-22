import { ApiClient } from '../../api/ApiClient';
import { Job, JobStatus } from '../../models/jobs/job';
import { HttpStatus } from '../../test-data/httpStatus';

export interface NewJob {
  task: string;
  durationMs: number; // how long the simulated job runs
  fail?: boolean; // the job ends as "failed"
  callbackUrl?: string; // the server POSTs the finished job here (webhook)
}

export interface PollOptions {
  intervalMs: number; // pause between two GETs
  timeoutMs: number; // the limit: give up after this time
}

// Background jobs of the local job server (mocks/jobServer.ts, a simulation).
export class JobService {
  constructor(private readonly client: ApiClient) {}

  start(job: NewJob) {
    return this.client.post<Job>('/jobs', { data: job });
  }

  get(id: string) {
    return this.client.get<Job>(`/jobs/${id}`);
  }

  // Polling: asks for the job again and again until it has ended (done or failed).
  // Gives up after timeoutMs with an error that says how far the job got - a test must
  // never wait forever. Returns the last answer, how many GETs it took and every status
  // it saw on the way (each one once, in order).
  async waitUntilFinished(id: string, { intervalMs, timeoutMs }: PollOptions) {
    const startedAt = Date.now();
    const seen: JobStatus[] = [];
    let polls = 0;
    for (;;) {
      const { status, body } = await this.get(id);
      polls++;
      if (status !== HttpStatus.OK) throw new Error(`GET /jobs/${id} answered ${status}: ${body.message ?? ''}`);
      if (seen[seen.length - 1] !== body.status) seen.push(body.status);
      if (body.status === 'done' || body.status === 'failed') return { job: body, polls, seen };
      if (Date.now() - startedAt + intervalMs > timeoutMs) {
        throw new Error(`job ${id} is still "${body.status}" after ${timeoutMs} ms (${polls} polls)`);
      }
      await new Promise((wait) => setTimeout(wait, intervalMs));
    }
  }
}
