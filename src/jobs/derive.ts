/**
 * What the Jobs section shows, computed from the register every time; nothing
 * here is stored.
 *
 * - The attention list: open jobs whose next step is overdue or due today, and
 *   open jobs with no next step at all (the ExO first pass's rule: every open
 *   proposal has a next step and a date).
 * - The figures the ExO plan measures: jobs waiting for a PO and their value,
 *   the average days from proposal to PO, and the share of decided proposals
 *   that became a PO. The dates come from the stage entries in each job's log.
 */

import { JOB_ID_PATTERN, OPEN_STAGES, type Job, type JobStage } from './model.ts';

export type AttentionKind = 'overdue' | 'today' | 'no-next-step';

export interface AttentionItem {
  readonly job: Job;
  readonly kind: AttentionKind;
  /** Days overdue (positive) for `overdue`; 0 otherwise. */
  readonly days: number;
}

export function isOpen(job: Job): boolean {
  return OPEN_STAGES.has(job.stage);
}

/** Whole days from `a` to `b` (YYYY-MM-DD), negative when `b` is earlier. */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Open jobs that need a look today: overdue first (oldest first), then due today, then those with no next step. */
export function attentionList(jobs: readonly Job[], today: string): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const job of jobs) {
    if (!isOpen(job)) continue;
    if (!job.nextStep.trim() || job.nextDue === null) items.push({ job, kind: 'no-next-step', days: 0 });
    else if (job.nextDue < today) items.push({ job, kind: 'overdue', days: daysBetween(job.nextDue, today) });
    else if (job.nextDue === today) items.push({ job, kind: 'today', days: 0 });
  }
  const rank: Record<AttentionKind, number> = { overdue: 0, today: 1, 'no-next-step': 2 };
  return items.sort((a, b) => rank[a.kind] - rank[b.kind] || b.days - a.days || a.job.id.localeCompare(b.job.id));
}

/** The date a job first entered `stage`, from its log, or null. */
export function enteredOn(job: Job, stage: JobStage): string | null {
  return job.log.find((e) => e.kind === 'stage' && e.stage === stage)?.on ?? null;
}

const PAST_PO: ReadonlySet<JobStage> = new Set<JobStage>(['awaiting-payment', 'work', 'handover', 'invoiced', 'paid', 'maintenance']);

/** The date a job got its PO: the first time it moved past "Waiting for PO". */
export function poOn(job: Job): string | null {
  return job.log.find((e) => e.kind === 'stage' && e.stage !== undefined && PAST_PO.has(e.stage))?.on ?? null;
}

export interface JobsStats {
  readonly open: number;
  readonly awaitingPo: number;
  /** Sum of the quoted values of jobs waiting for a PO (jobs with no value are left out). */
  readonly awaitingPoValue: number;
  readonly awaitingPayment: number;
  /** Overdue or due today. */
  readonly due: number;
  readonly noNextStep: number;
  /** Average days from "Waiting for PO" to the PO, over jobs that have both dates; null when none. */
  readonly avgDaysToPo: number | null;
  /** Proposals that became a PO, out of proposals decided either way (PO or lost); null when none decided. */
  readonly winRate: { readonly won: number; readonly decided: number } | null;
}

export function jobsStats(jobs: readonly Job[], today: string): JobsStats {
  const attention = attentionList(jobs, today);
  const waiting = jobs.filter((j) => j.stage === 'awaiting-po');
  const spans: number[] = [];
  let won = 0;
  let decided = 0;
  for (const job of jobs) {
    const proposed = enteredOn(job, 'awaiting-po');
    if (proposed === null) continue;
    const po = poOn(job);
    if (po !== null) {
      won += 1;
      decided += 1;
      spans.push(Math.max(0, daysBetween(proposed, po)));
    } else if (job.stage === 'lost') {
      decided += 1;
    }
  }
  return {
    open: jobs.filter(isOpen).length,
    awaitingPo: waiting.length,
    awaitingPoValue: waiting.reduce((sum, j) => sum + (j.value ?? 0), 0),
    awaitingPayment: jobs.filter((j) => j.stage === 'awaiting-payment').length,
    due: attention.filter((a) => a.kind !== 'no-next-step').length,
    noNextStep: attention.filter((a) => a.kind === 'no-next-step').length,
    avgDaysToPo: spans.length ? Math.round(spans.reduce((a, b) => a + b, 0) / spans.length) : null,
    winRate: decided ? { won, decided } : null,
  };
}

export type JobsFilter = 'open' | 'closed' | 'all' | JobStage;

export function filterJobs(jobs: readonly Job[], filter: JobsFilter): Job[] {
  const list = filter === 'all' ? [...jobs] : filter === 'open' ? jobs.filter(isOpen) : filter === 'closed' ? jobs.filter((j) => !isOpen(j)) : jobs.filter((j) => j.stage === filter);
  // Newest job numbers first: the register reads like an inbox.
  return list.sort((a, b) => jobOrder(b) - jobOrder(a));
}

/** Sort key for a job number: year, then the running number (so CT-26-1000 comes after CT-26-999). */
function jobOrder(job: Job): number {
  const m = JOB_ID_PATTERN.exec(job.id);
  return m ? Number(m[1]) * 100_000 + Number(m[2]) : 0;
}

/** "SAR 12,500", or an em dash when there is no figure. */
export function formatSar(value: number | null): string {
  return value === null ? '—' : `SAR ${Math.round(value).toLocaleString('en-US')}`;
}
