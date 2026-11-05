/**
 * The jobs register without a DOM: numbers, the file format and its validation,
 * the updaters, the attention list and the pipeline figures, and the browser
 * store's error handling.
 */

import { describe, expect, it } from 'vitest';

import { attentionList, daysBetween, filterJobs, formatSar, jobsStats, poOn } from './derive.ts';
import { addJob, addLogEntry, moveStage, removeJob, suggestedNextStage, updateJob } from './jobsState.ts';
import { JOBS_FORMAT, JOBS_VERSION, MAX_LOG_ENTRIES, newJob, nextJobId, parseJobs, serializeJobs, type Job } from './model.ts';
import { loadJobs, saveJobs, type JobsStore } from './store.ts';

const T = '2026-11-05';

function job(over: Partial<Job> = {}, jobs: readonly Job[] = [], today = T): Job {
  return { ...newJob({ title: 'CCTV, 12 cameras', client: 'Al Noor Warehouse', service: 'cctv' }, jobs, today), ...over };
}

/** A job created on `created`, moved through `moves` on the given dates. */
function withMoves(created: string, moves: readonly [Job['stage'], string][], over: Partial<Job> = {}, id = 'CT-26-001'): Job {
  let jobs: Job[] = [{ ...job({}, [], created), id, ...over }];
  for (const [stage, on] of moves) jobs = moveStage(jobs, id, stage, on);
  return jobs[0]!;
}

describe('job numbers and new jobs', () => {
  it('numbers jobs per year, one more than the highest used, padded to three digits', () => {
    expect(nextJobId([], T)).toBe('CT-26-001');
    const a = job({ id: 'CT-26-007' });
    const old = job({ id: 'CT-25-040' });
    expect(nextJobId([a, old], T)).toBe('CT-26-008');
    expect(nextJobId([a], '2027-01-02')).toBe('CT-27-001');
    expect(nextJobId([job({ id: 'CT-26-999' })], T)).toBe('CT-26-1000');
  });

  it('starts a new job at Enquiry with one stage entry, trimmed text and no next step', () => {
    const j = newJob({ title: '  Renovation of two rooms ', client: ' Mr Saleh ', service: 'renovation', city: 'Jeddah', value: 18500 }, [], T);
    expect(j).toMatchObject({ id: 'CT-26-001', title: 'Renovation of two rooms', client: 'Mr Saleh', stage: 'enquiry', value: 18500, nextStep: '', nextDue: null, createdOn: T });
    expect(j.log).toEqual([{ on: T, kind: 'stage', stage: 'enquiry', text: 'Enquiry recorded.' }]);
  });
});

describe('the jobs file', () => {
  it('round-trips through serialize and parse unchanged', () => {
    const jobs = [job(), job({ id: 'CT-26-002', value: 25000, terms: 'credit' })];
    const text = serializeJobs(jobs);
    expect(JSON.parse(text)).toMatchObject({ format: JOBS_FORMAT, v: JOBS_VERSION });
    const r = parseJobs(text);
    expect(r.ok && r.jobs).toEqual(jobs);
    expect(r.ok && serializeJobs(r.jobs)).toBe(text);
    // A job with history (stage moves, follow-ups) re-saves byte for byte too.
    let moved = moveStage(jobs, 'CT-26-001', 'awaiting-po', T);
    moved = addLogEntry(moved, 'CT-26-001', 'follow-up', 'Called', T);
    const again = parseJobs(serializeJobs(moved));
    expect(again.ok && serializeJobs(again.jobs)).toBe(serializeJobs(moved));
  });

  it('refuses bad files with a reason, naming the field', () => {
    expect(parseJobs('{not json').ok).toBe(false);
    const project = parseJobs(JSON.stringify({ format: 'contractech-cctv-workspace', v: 1 }));
    expect(!project.ok && project.reason).toMatch(/not a jobs register/);
    const badDate = parseJobs(serializeJobs([job({ nextDue: '5/11/2026' })]));
    expect(!badDate.ok && badDate.reason).toMatch(/jobs\.0\.nextDue/);
    const extra = parseJobs(JSON.stringify({ format: JOBS_FORMAT, v: JOBS_VERSION, jobs: [{ ...job(), secret: 1 }] }));
    expect(!extra.ok && extra.reason).toMatch(/jobs\.0/);
    const dup = parseJobs(serializeJobs([job(), job()]));
    expect(!dup.ok && dup.reason).toMatch(/CT-26-001 appears twice/);
    const badId = parseJobs(serializeJobs([job({ id: 'JOB-1' })]));
    expect(!badId.ok && badId.reason).toMatch(/jobs\.0\.id/);
    const newer = parseJobs(JSON.stringify({ format: JOBS_FORMAT, v: 2, jobs: [] }));
    expect(newer.ok).toBe(false);
  });
});

describe('updaters', () => {
  it('logs every stage change once, with the date, and stamps the job', () => {
    let jobs = [job()];
    jobs = moveStage(jobs, 'CT-26-001', 'awaiting-po', '2026-11-06');
    jobs = moveStage(jobs, 'CT-26-001', 'awaiting-po', '2026-11-07'); // same stage: no change
    const j = jobs[0]!;
    expect(j.stage).toBe('awaiting-po');
    expect(j.updatedOn).toBe('2026-11-06');
    expect(j.log.at(-1)).toEqual({ on: '2026-11-06', kind: 'stage', stage: 'awaiting-po', text: 'Moved to Waiting for PO.' });
    expect(j.log).toHaveLength(2);
  });

  it('adds follow-ups and notes, ignores empty ones, and caps the history', () => {
    let jobs = [job()];
    jobs = addLogEntry(jobs, 'CT-26-001', 'follow-up', '  Called; PO next week ', T);
    jobs = addLogEntry(jobs, 'CT-26-001', 'note', '   ', T);
    expect(jobs[0]!.log.at(-1)).toEqual({ on: T, kind: 'follow-up', text: 'Called; PO next week' });
    expect(jobs[0]!.log).toHaveLength(2);
    for (let i = 0; i < MAX_LOG_ENTRIES + 5; i += 1) jobs = addLogEntry(jobs, 'CT-26-001', 'note', `n${i}`, T);
    expect(jobs[0]!.log).toHaveLength(MAX_LOG_ENTRIES);
    expect(jobs[0]!.log.at(-1)!.text).toBe(`n${MAX_LOG_ENTRIES + 4}`);
  });

  it('edits fields, adds and removes jobs, leaving the others alone', () => {
    const other = job({ id: 'CT-26-002' });
    let jobs = addJob([job()], other);
    jobs = updateJob(jobs, 'CT-26-001', { nextStep: 'Call Ahmed', nextDue: '2026-11-09' }, '2026-11-06');
    expect(jobs[0]).toMatchObject({ nextStep: 'Call Ahmed', nextDue: '2026-11-09', updatedOn: '2026-11-06' });
    expect(jobs[1]).toBe(other);
    expect(removeJob(jobs, 'CT-26-001').map((j) => j.id)).toEqual(['CT-26-002']);
  });

  it('suggests the usual next stage: after the PO, credit goes to work and anything else waits for the transfer', () => {
    expect(suggestedNextStage(job({ stage: 'enquiry' }))).toBe('survey');
    expect(suggestedNextStage(job({ stage: 'awaiting-po', terms: 'credit' }))).toBe('work');
    expect(suggestedNextStage(job({ stage: 'awaiting-po', terms: 'advance' }))).toBe('awaiting-payment');
    expect(suggestedNextStage(job({ stage: 'awaiting-po', terms: null }))).toBe('awaiting-payment');
    expect(suggestedNextStage(job({ stage: 'invoiced' }))).toBe('paid');
    expect(suggestedNextStage(job({ stage: 'lost' }))).toBeNull();
  });
});

describe('what needs attention, and the figures', () => {
  it('lists overdue first (oldest first), then due today, then open jobs with no next step; closed jobs never', () => {
    const jobs = [
      job({ id: 'CT-26-001', stage: 'awaiting-po', nextStep: 'Call', nextDue: '2026-11-04' }),
      job({ id: 'CT-26-002', stage: 'awaiting-payment', nextStep: 'Chase transfer', nextDue: '2026-10-30' }),
      job({ id: 'CT-26-003', stage: 'survey', nextStep: 'Visit', nextDue: T }),
      job({ id: 'CT-26-004', stage: 'enquiry' }),
      job({ id: 'CT-26-005', stage: 'work', nextStep: 'Pull cables', nextDue: '2026-11-20' }),
      job({ id: 'CT-26-006', stage: 'paid' }),
      job({ id: 'CT-26-007', stage: 'lost', nextStep: 'x', nextDue: '2026-01-01' }),
    ];
    const list = attentionList(jobs, T);
    expect(list.map((a) => [a.job.id, a.kind, a.days])).toEqual([
      ['CT-26-002', 'overdue', 6],
      ['CT-26-001', 'overdue', 1],
      ['CT-26-003', 'today', 0],
      ['CT-26-004', 'no-next-step', 0],
    ]);
  });

  it('measures proposal to PO from the stage dates, and counts decided proposals', () => {
    const won = withMoves('2026-10-01', [['awaiting-po', '2026-10-02'], ['awaiting-payment', '2026-10-30'], ['work', '2026-11-02']], { value: 20000 }, 'CT-26-001');
    const credit = withMoves('2026-10-05', [['awaiting-po', '2026-10-06'], ['work', '2026-10-16']], {}, 'CT-26-002');
    const lost = withMoves('2026-10-05', [['awaiting-po', '2026-10-06'], ['lost', '2026-10-20']], {}, 'CT-26-003');
    const waiting = withMoves('2026-10-10', [['awaiting-po', '2026-10-11']], { value: 12500 }, 'CT-26-004');
    const enquiry = job({ id: 'CT-26-005' });
    expect(poOn(won)).toBe('2026-10-30');
    const s = jobsStats([won, credit, lost, waiting, enquiry], T);
    expect(s.avgDaysToPo).toBe(19); // (28 + 10) / 2
    expect(s.winRate).toEqual({ won: 2, decided: 3 });
    expect(s.awaitingPo).toBe(1);
    expect(s.awaitingPoValue).toBe(12500);
    expect(s.open).toBe(4);
    expect(jobsStats([], T)).toMatchObject({ avgDaysToPo: null, winRate: null, open: 0 });
  });

  it('filters and orders newest first, with four-digit numbers after three-digit ones', () => {
    const jobs = [job({ id: 'CT-26-999' }), job({ id: 'CT-26-1000' }), job({ id: 'CT-25-500', stage: 'paid' })];
    expect(filterJobs(jobs, 'all').map((j) => j.id)).toEqual(['CT-26-1000', 'CT-26-999', 'CT-25-500']);
    expect(filterJobs(jobs, 'open').map((j) => j.id)).toEqual(['CT-26-1000', 'CT-26-999']);
    expect(filterJobs(jobs, 'closed').map((j) => j.id)).toEqual(['CT-25-500']);
    expect(filterJobs(jobs, 'paid').map((j) => j.id)).toEqual(['CT-25-500']);
  });

  it('formats money and counts days', () => {
    expect(formatSar(18500)).toBe('SAR 18,500');
    expect(formatSar(null)).toBe('—');
    expect(daysBetween('2026-10-30', '2026-11-05')).toBe(6);
  });
});

describe('the browser store', () => {
  const memory = (initial: string | null = null): JobsStore & { text: string | null } => ({
    text: initial,
    async load() {
      return this.text;
    },
    async save(t: string) {
      this.text = t;
    },
  });

  it('loads an empty register when nothing is saved, and reads back what was saved', async () => {
    const store = memory();
    expect(await loadJobs(store)).toEqual({ ok: true, jobs: [] });
    expect(await saveJobs(store, [job()])).toEqual({ ok: true });
    const r = await loadJobs(store);
    expect(r.ok && r.jobs.map((j) => j.id)).toEqual(['CT-26-001']);
  });

  it('reports a store that fails or holds an unreadable register, instead of throwing', async () => {
    const broken: JobsStore = {
      load: () => Promise.reject(new Error('blocked')),
      save: () => Promise.reject(new Error('quota exceeded')),
    };
    const loaded = await loadJobs(broken);
    expect(!loaded.ok && loaded.reason).toMatch(/could not be read.*blocked/);
    const saved = await saveJobs(broken, []);
    expect(!saved.ok && saved.reason).toMatch(/could not be saved.*quota exceeded.*Export a backup/);
    const garbled = await loadJobs(memory('{"format":"contractech-jobs","v":1,"jobs":[{"id":1}]}'));
    expect(!garbled.ok && garbled.reason).toMatch(/unreadable/);
  });
});
