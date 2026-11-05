/**
 * Small pure updaters for the jobs register, tested without a DOM. Every change
 * stamps the job's `updatedOn`; a stage change also writes a log entry, so the
 * job's history (and the dates the metrics in derive.ts read) builds itself.
 */

import { MAX_LOG_ENTRIES, STAGE_LABEL, type Job, type JobLogEntry, type JobStage, type LogKind } from './model.ts';

/** Fields the job dialog edits directly. Stage and log go through their own updaters. */
export type JobPatch = Partial<Omit<Job, 'id' | 'stage' | 'log' | 'createdOn' | 'updatedOn'>>;

function withLog(log: readonly JobLogEntry[], entry: JobLogEntry): JobLogEntry[] {
  const next = [...log, entry];
  // Keep the newest entries if a very long-running job ever reaches the cap.
  return next.length > MAX_LOG_ENTRIES ? next.slice(next.length - MAX_LOG_ENTRIES) : next;
}

function mapJob(jobs: readonly Job[], id: string, f: (job: Job) => Job): Job[] {
  return jobs.map((j) => (j.id === id ? f(j) : j));
}

export function addJob(jobs: readonly Job[], job: Job): Job[] {
  return [...jobs, job];
}

export function updateJob(jobs: readonly Job[], id: string, patch: JobPatch, today: string): Job[] {
  return mapJob(jobs, id, (j) => ({ ...j, ...patch, updatedOn: today }));
}

/** Moves a job to `stage` and logs it. Moving to the stage it is already in changes nothing. */
export function moveStage(jobs: readonly Job[], id: string, stage: JobStage, today: string): Job[] {
  return mapJob(jobs, id, (j) =>
    j.stage === stage ? j : { ...j, stage, updatedOn: today, log: withLog(j.log, { on: today, kind: 'stage', text: `Moved to ${STAGE_LABEL[stage]}.`, stage }) },
  );
}

/** Adds a follow-up or a note to the job's log. Empty text is ignored. */
export function addLogEntry(jobs: readonly Job[], id: string, kind: Exclude<LogKind, 'stage'>, text: string, today: string): Job[] {
  const t = text.trim().slice(0, 1000);
  if (!t) return [...jobs];
  return mapJob(jobs, id, (j) => ({ ...j, updatedOn: today, log: withLog(j.log, { on: today, kind, text: t }) }));
}

export function removeJob(jobs: readonly Job[], id: string): Job[] {
  return jobs.filter((j) => j.id !== id);
}

/**
 * The stage a job usually goes to next, or null when it is closed. After the PO,
 * a job on credit goes straight to work; any other waits for the transfer.
 */
export function suggestedNextStage(job: Job): JobStage | null {
  switch (job.stage) {
    case 'enquiry':
      return 'survey';
    case 'survey':
      return 'awaiting-po';
    case 'awaiting-po':
      return job.terms === 'credit' ? 'work' : 'awaiting-payment';
    case 'awaiting-payment':
      return 'work';
    case 'work':
      return 'handover';
    case 'handover':
      return 'invoiced';
    case 'invoiced':
      return 'paid';
    case 'paid':
    case 'maintenance':
    case 'lost':
      return null;
  }
}
