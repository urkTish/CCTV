/**
 * The jobs register: one record per client enquiry, from first contact to the
 * PO, the payment, the work, the invoice and maintenance (docs/exo/
 * contractech-exo-first-pass.md, section 7.1).
 *
 * It is ContracTech's own record of every job, kept apart from the project
 * files: a project file is one design; the register is the whole pipeline. It
 * is saved in this browser (store.ts) and exported as a `contractech-jobs` JSON
 * file, which is also what the follow-up assistant skill reads.
 *
 * As everywhere else in the portal, opening a file is a validation boundary:
 * every object schema is strict, every string and list is capped, and a bad file
 * is refused with the path of the first problem. Types are inferred from the
 * schemas so the two cannot drift apart.
 */

import { z } from 'zod';

export const JOBS_FORMAT = 'contractech-jobs';
export const JOBS_VERSION = 1;
export const MAX_JOBS = 5000;
export const MAX_LOG_ENTRIES = 500;
export const MAX_JOBS_FILE_CHARS = 20_000_000;

// ---------------------------------------------------------------------------
// Enumerations, with the labels the Admin shows
// ---------------------------------------------------------------------------

/** In pipeline order. `lost` is the one way out that is not a won job. */
export const JOB_STAGES = ['enquiry', 'survey', 'awaiting-po', 'awaiting-payment', 'work', 'handover', 'invoiced', 'paid', 'maintenance', 'lost'] as const;
export type JobStage = (typeof JOB_STAGES)[number];

export const STAGE_LABEL: Readonly<Record<JobStage, string>> = {
  enquiry: 'Enquiry',
  survey: 'Site survey',
  'awaiting-po': 'Waiting for PO',
  'awaiting-payment': 'Waiting for payment',
  work: 'Work in progress',
  handover: 'Handover',
  invoiced: 'Invoiced',
  paid: 'Paid',
  maintenance: 'Maintenance',
  lost: 'Lost',
};

export const STAGE_HELP: Readonly<Record<JobStage, string>> = {
  enquiry: 'A client has asked; nothing sent yet.',
  survey: 'A site visit is booked or done.',
  'awaiting-po': 'The proposal is sent; waiting for the client’s purchase order.',
  'awaiting-payment': 'PO received; waiting for the client’s transfer before work starts.',
  work: 'Work on site is under way.',
  handover: 'Work is finished and being handed over.',
  invoiced: 'Invoice sent; waiting for the final payment.',
  paid: 'Paid in full. Closed.',
  maintenance: 'Paid, and under a maintenance contract.',
  lost: 'The client went elsewhere or cancelled. Closed.',
};

/** Stages where the job is still moving and should always have a next step. */
export const OPEN_STAGES: ReadonlySet<JobStage> = new Set<JobStage>(['enquiry', 'survey', 'awaiting-po', 'awaiting-payment', 'work', 'handover', 'invoiced']);

export const SERVICES = ['cctv', 'network', 'alarm', 'renovation', 'maintenance', 'construction', 'electromechanical', 'supply', 'other'] as const;
export type JobService = (typeof SERVICES)[number];

export const SERVICE_LABEL: Readonly<Record<JobService, string>> = {
  cctv: 'CCTV',
  network: 'IT and network',
  alarm: 'Intrusion and alarm',
  renovation: 'Renovation',
  maintenance: 'Maintenance',
  construction: 'Construction',
  electromechanical: 'Electrical and mechanical',
  supply: 'Supply only',
  other: 'Other',
};

export const PAYMENT_TERMS = ['advance', 'credit'] as const;
export type PaymentTerms = (typeof PAYMENT_TERMS)[number];

export const TERMS_LABEL: Readonly<Record<PaymentTerms, string>> = {
  advance: 'Paid before work (transfer)',
  credit: 'On credit',
};

export const LOG_KINDS = ['stage', 'follow-up', 'note'] as const;
export type LogKind = (typeof LOG_KINDS)[number];

export const LOG_KIND_LABEL: Readonly<Record<LogKind, string>> = {
  stage: 'Stage',
  'follow-up': 'Follow-up',
  note: 'Note',
};

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected a YYYY-MM-DD date');
const text = (max: number) => z.string().max(max);

/** `CT-26-001`: the year the enquiry came in, then a running number for that year. */
export const JOB_ID_PATTERN = /^CT-(\d{2})-(\d{3,4})$/;

const logEntrySchema = z
  .object({
    on: isoDate,
    kind: z.enum(LOG_KINDS),
    text: text(1000),
    /** For a stage entry: the stage the job moved into. */
    stage: z.enum(JOB_STAGES).optional(),
  })
  .strict();

export const jobSchema = z
  .object({
    id: z.string().regex(JOB_ID_PATTERN, 'expected a job number like CT-26-001'),
    title: text(160),
    client: text(160),
    contact: text(160),
    phone: text(40),
    email: text(160),
    city: text(80),
    service: z.enum(SERVICES),
    /** SAR, as quoted. Null until there is a figure. */
    value: z.number().finite().min(0).max(1_000_000_000).nullable(),
    terms: z.enum(PAYMENT_TERMS).nullable(),
    stage: z.enum(JOB_STAGES),
    nextStep: text(300),
    nextDue: isoDate.nullable(),
    lostReason: text(300),
    documents: text(1000),
    notes: text(2000),
    createdOn: isoDate,
    updatedOn: isoDate,
    log: z.array(logEntrySchema).max(MAX_LOG_ENTRIES),
  })
  .strict();

export type Job = z.infer<typeof jobSchema>;
export type JobLogEntry = Job['log'][number];

const registerSchema = z
  .object({
    format: z.literal(JOBS_FORMAT),
    v: z.literal(JOBS_VERSION),
    jobs: z.array(jobSchema).max(MAX_JOBS),
  })
  .strict()
  .superRefine((r, ctx) => {
    const seen = new Set<string>();
    r.jobs.forEach((job, i) => {
      if (seen.has(job.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['jobs', i, 'id'], message: `job number ${job.id} appears twice` });
      seen.add(job.id);
    });
  });

// ---------------------------------------------------------------------------
// File in / file out
// ---------------------------------------------------------------------------

export type JobsResult = { readonly ok: true; readonly jobs: Job[] } | { readonly ok: false; readonly reason: string };

/**
 * The register as a `contractech-jobs` JSON document. Keys follow the schema's order
 * (every object is built that way), so opening a file and saving it again gives
 * the same bytes.
 */
export function serializeJobs(jobs: readonly Job[]): string {
  return JSON.stringify({ format: JOBS_FORMAT, v: JOBS_VERSION, jobs }, null, 2);
}

/** Parses a jobs file. Never throws: a bad file comes back with the reason and the path of the first problem. */
export function parseJobs(text: string): JobsResult {
  if (text.length > MAX_JOBS_FILE_CHARS) return { ok: false, reason: 'The jobs file is too large to be a jobs register.' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return { ok: false, reason: `The jobs file is not valid JSON (${err instanceof Error ? err.message : 'parse error'}).` };
  }
  if (typeof parsed === 'object' && parsed !== null && 'format' in parsed && parsed.format !== JOBS_FORMAT) {
    return { ok: false, reason: 'This is not a jobs register (a project or intake file opens from the Overview).' };
  }
  const r = registerSchema.safeParse(parsed);
  if (!r.success) {
    const first = r.error.issues[0];
    return { ok: false, reason: `The jobs file failed validation at "${(first?.path ?? []).join('.')}": ${first?.message ?? 'unknown'}.` };
  }
  return { ok: true, jobs: r.data.jobs };
}

export function jobsFileName(today: string): string {
  return `contractech-jobs-${today}.json`;
}

// ---------------------------------------------------------------------------
// Ids and new jobs
// ---------------------------------------------------------------------------

/** The next job number for the year of `today`: one more than the highest used that year. */
export function nextJobId(jobs: readonly Job[], today: string): string {
  const yy = today.slice(2, 4);
  let highest = 0;
  for (const job of jobs) {
    const m = JOB_ID_PATTERN.exec(job.id);
    if (m && m[1] === yy) highest = Math.max(highest, Number(m[2]));
  }
  return `CT-${yy}-${String(highest + 1).padStart(3, '0')}`;
}

export interface NewJobInput {
  readonly title: string;
  readonly client: string;
  readonly service: JobService;
  readonly contact?: string;
  readonly phone?: string;
  readonly city?: string;
  readonly value?: number | null;
}

/** A new job at the enquiry stage, with its first log entry. */
export function newJob(input: NewJobInput, jobs: readonly Job[], today: string): Job {
  return {
    id: nextJobId(jobs, today),
    title: input.title.trim().slice(0, 160),
    client: input.client.trim().slice(0, 160),
    contact: (input.contact ?? '').trim().slice(0, 160),
    phone: (input.phone ?? '').trim().slice(0, 40),
    email: '',
    city: (input.city ?? '').trim().slice(0, 80),
    service: input.service,
    value: input.value ?? null,
    terms: null,
    stage: 'enquiry',
    nextStep: '',
    nextDue: null,
    lostReason: '',
    documents: '',
    notes: '',
    createdOn: today,
    updatedOn: today,
    log: [{ on: today, kind: 'stage', text: 'Enquiry recorded.', stage: 'enquiry' }],
  };
}
