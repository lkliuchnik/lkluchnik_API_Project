// A background job of the local job server (mocks/jobServer.ts, a simulation).
export type JobStatus = 'pending' | 'running' | 'done' | 'failed';

export interface Job {
  id: string;
  task: string;
  status: JobStatus;
  result?: string; // when done
  error?: string; // when failed
}
