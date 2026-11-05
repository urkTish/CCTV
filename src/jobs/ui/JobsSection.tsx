/**
 * Admin → Jobs: ContracTech's own register of every enquiry, from first contact
 * to the PO, the payment, the work and maintenance (docs/exo/
 * contractech-exo-first-pass.md, section 7.1).
 *
 * The screen answers three questions in order: what needs doing today (the
 * attention list), where every job stands (the list) and how the pipeline is
 * doing (the figures). The register is saved in this browser; Backup exports it
 * as a `contractech-jobs` file, which the follow-up assistant skill also reads.
 *
 * Stand-alone like the camera finder: nothing here touches the open project.
 */

import { useState } from 'react';

import { downloadText, readFileAsText } from '../../ui/fileIo.ts';
import { Button, Card, Dialog, EmptyState, Notice, SelectField, Stat, StatusBadge, TextField } from '../../ui/primitives.tsx';
import { buttonClass } from '../../ui/uiStyles.ts';
import { attentionList, filterJobs, formatSar, jobsStats, type AttentionItem, type JobsFilter } from '../derive.ts';
import { addJob, addLogEntry, moveStage, removeJob, updateJob } from '../jobsState.ts';
import { JOB_STAGES, jobsFileName, newJob, parseJobs, serializeJobs, SERVICE_LABEL, SERVICES, STAGE_LABEL, type Job, type JobService } from '../model.ts';
import { AmountField } from './fields.tsx';
import { JobDialog } from './JobDialog.tsx';
import type { JobsRegister } from './useJobsRegister.ts';

const FILTERS: readonly { value: JobsFilter; label: string }[] = [
  { value: 'open', label: 'Open jobs' },
  ...JOB_STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s] })),
  { value: 'closed', label: 'Closed (paid, maintenance, lost)' },
  { value: 'all', label: 'All jobs' },
];

const SERVICE_OPTIONS = SERVICES.map((s) => ({ value: s, label: SERVICE_LABEL[s] }));

function attentionBadge(item: AttentionItem) {
  if (item.kind === 'overdue') return <StatusBadge kind="blocked">{`Overdue ${item.days} day${item.days === 1 ? '' : 's'}`}</StatusBadge>;
  if (item.kind === 'today') return <StatusBadge kind="attention">Due today</StatusBadge>;
  return <StatusBadge kind="attention">No next step</StatusBadge>;
}

function NewJobDialog({ open, onCancel, onCreate }: { open: boolean; onCancel: () => void; onCreate: (input: { client: string; title: string; service: JobService; city: string; phone: string; value: number | null }) => void }) {
  const [client, setClient] = useState('');
  const [title, setTitle] = useState('');
  const [service, setService] = useState<JobService>('cctv');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [value, setValue] = useState<number | null>(null);
  const [tried, setTried] = useState(false);
  const missing = !client.trim() || !title.trim();
  const reset = () => {
    setClient('');
    setTitle('');
    setService('cctv');
    setCity('');
    setPhone('');
    setValue(null);
    setTried(false);
  };
  return (
    <Dialog
      title="New job"
      open={open}
      onClose={() => {
        reset();
        onCancel();
      }}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {tried && missing && <span className="text-sm text-[var(--color-fail)]">Add the client and what the job is.</span>}
          <Button
            onClick={() => {
              reset();
              onCancel();
            }}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setTried(true);
              if (missing) return;
              onCreate({ client, title, service, city, phone, value });
              reset();
            }}
          >
            Create job
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Client" helper="Company or person." value={client} onChange={(v) => setClient(v.slice(0, 160))} />
        <TextField label="Job" helper="What the job is, e.g. “12 cameras for the warehouse”." value={title} onChange={(v) => setTitle(v.slice(0, 160))} />
        <SelectField label="Service" helper="The main kind of work." value={service} options={SERVICE_OPTIONS} onChange={setService} />
        <TextField label="City" helper="Where the site is." value={city} onChange={(v) => setCity(v.slice(0, 80))} />
        <TextField label="Phone" helper="Optional." type="tel" value={phone} onChange={(v) => setPhone(v.slice(0, 40))} />
        <AmountField label="Value" helper="Optional: leave empty until there is a figure." value={value} onChange={setValue} />
      </div>
      <p className="mt-3 text-sm text-[var(--color-ink-3)]">The job starts at Enquiry and gets the next free number. Everything else can be added later.</p>
    </Dialog>
  );
}

export function JobsSection({ register, today }: { register: JobsRegister; today: string }) {
  const { jobs, ready, status } = register;
  const [filter, setFilter] = useState<JobsFilter>('open');
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [pendingImport, setPendingImport] = useState<{ jobs: Job[]; fileName: string } | null>(null);

  const stats = jobsStats(jobs, today);
  const attention = attentionList(jobs, today);
  const shown = filterJobs(jobs, filter);
  const openJob = openId === null ? undefined : jobs.find((j) => j.id === openId);

  const exportRegister = () => {
    const err = downloadText(jobsFileName(today), serializeJobs(jobs), 'application/json');
    setMessage(err ? { kind: 'error', text: `The register was not exported. ${err}` } : { kind: 'success', text: `Exported ${jobs.length} job${jobs.length === 1 ? '' : 's'} as ${jobsFileName(today)}.` });
  };

  const importFile = async (file: File) => {
    let text: string;
    try {
      text = await readFileAsText(file);
    } catch (err) {
      setMessage({ kind: 'error', text: `${file.name} could not be read (${err instanceof Error ? err.message : 'unknown error'}).` });
      return;
    }
    const r = parseJobs(text);
    if (!r.ok) {
      setMessage({ kind: 'error', text: `${file.name} was not imported. ${r.reason}` });
      return;
    }
    if (jobs.length === 0) {
      register.replace(r.jobs);
      setMessage({ kind: 'success', text: `Imported ${r.jobs.length} job${r.jobs.length === 1 ? '' : 's'} from ${file.name}.` });
    } else {
      setPendingImport({ jobs: r.jobs, fileName: file.name });
    }
  };

  return (
    <div className="grid gap-4">
      {status.kind === 'unavailable' && (
        <Notice kind="warning" title="Not saved in this browser">
          <p>This browser cannot store the register, so jobs last only while this page is open. Export the register (under Backup) before you close it.</p>
        </Notice>
      )}
      {status.kind === 'error' && (
        <Notice kind="error" title="The register has a problem" role="alert">
          <p>{status.text}</p>
        </Notice>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-ink-2)]">{status.kind === 'loading' ? 'Loading the register…' : `${jobs.length} job${jobs.length === 1 ? '' : 's'} in the register.`}</p>
        <Button variant="primary" icon="plus" disabled={!ready} onClick={() => setCreating(true)}>
          New job
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Open jobs" value={stats.open} note="Still moving" />
        <Stat label="Waiting for PO" value={stats.awaitingPo} note={stats.awaitingPoValue > 0 ? formatSar(stats.awaitingPoValue) : 'Proposals sent'} />
        <Stat label="Follow-ups due" value={stats.due} note={stats.noNextStep > 0 ? `${stats.noNextStep} open without a next step` : 'Overdue or due today'} />
        <Stat
          label="Proposal to PO"
          value={stats.avgDaysToPo === null ? '—' : `${stats.avgDaysToPo} days`}
          note={stats.winRate ? `${stats.winRate.won} of ${stats.winRate.decided} decided proposals won` : 'Shows once proposals get a PO or are lost'}
        />
      </div>

      <Card title="Needs attention" subtitle="Overdue and due-today follow-ups first, then open jobs with no next step.">
        {attention.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-2)]">{jobs.length === 0 ? 'Nothing yet: add the first job.' : 'Nothing due today, and every open job has a next step.'}</p>
        ) : (
          <ul className="grid gap-2" aria-label="Jobs that need attention">
            {attention.map((item) => (
              <li key={item.job.id} className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-[var(--color-border)] px-3 py-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {attentionBadge(item)}
                    <span className="font-mono text-sm text-[var(--color-ink-2)]">{item.job.id}</span>
                    <span className="font-medium text-[var(--color-ink)]" dir="auto">
                      {item.job.client || 'Client not named'}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-[var(--color-ink-2)]" dir="auto">
                    {item.kind === 'no-next-step' ? `${STAGE_LABEL[item.job.stage]} · ${item.job.title}` : item.job.nextStep}
                  </p>
                </div>
                <Button size="sm" ariaLabel={`Open ${item.job.id}`} onClick={() => setOpenId(item.job.id)}>
                  Open
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="All jobs"
        subtitle="Newest first. Open a job to change its stage, next step and details."
        actions={
          <div className="w-60 max-w-full">
            <SelectField label="Show" helper="Open jobs are the ones still moving." value={filter} options={FILTERS} onChange={setFilter} />
          </div>
        }
      >
        {jobs.length === 0 ? (
          <EmptyState
            icon="clipboard-check"
            title="No jobs yet"
            action={
              <Button icon="plus" disabled={!ready} onClick={() => setCreating(true)}>
                Add the first job
              </Button>
            }
          >
            Record each enquiry as it comes in. Every job gets a number (CT-26-001), a stage and a next step, so no proposal waits without a follow-up.
          </EmptyState>
        ) : shown.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-2)]">No jobs in this view.</p>
        ) : (
          <table className="stack-table w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-ink-3)]">
                <th className="py-2 pr-3 font-medium">Job</th>
                <th className="py-2 pr-3 font-medium">Client and job</th>
                <th className="py-2 pr-3 font-medium">Stage</th>
                <th className="py-2 pr-3 text-right font-medium">Value</th>
                <th className="py-2 font-medium">Next step</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((job) => (
                <tr key={job.id} className="border-b border-[var(--color-border)] last:border-b-0 align-top">
                  <td className="py-2 pr-3">
                    <button type="button" className="font-mono text-[var(--color-accent)] underline" onClick={() => setOpenId(job.id)} aria-label={`Open ${job.id}`}>
                      {job.id}
                    </button>
                  </td>
                  <td className="py-2 pr-3" data-label="Client">
                    {/* One child, so on a phone the client and the job stack on the right of the label. */}
                    <div>
                      <span className="block font-medium text-[var(--color-ink)]" dir="auto">
                        {job.client || 'Client not named'}
                      </span>
                      <span className="block text-[var(--color-ink-2)]" dir="auto">
                        {job.title}
                      </span>
                    </div>
                  </td>
                  <td className="py-2 pr-3" data-label="Stage">
                    <span>{STAGE_LABEL[job.stage]}</span>
                  </td>
                  <td className="py-2 pr-3 text-right font-mono" data-label="Value">
                    <span>{formatSar(job.value)}</span>
                  </td>
                  <td className="py-2" data-label="Next step">
                    <span className="block" dir="auto">
                      {job.nextStep || '—'}
                      {job.nextDue && <span className="text-[var(--color-ink-3)]"> · {job.nextDue}</span>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Backup" subtitle={status.kind === 'saved' ? 'Saved in this browser.' : 'Keep a copy outside this browser.'}>
        <p className="text-sm text-[var(--color-ink-2)]">
          The register lives in this browser only. Export it now and then, and always before clearing the browser or moving to another computer. The follow-up
          assistant reads the exported file.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button icon="download" disabled={!ready} onClick={exportRegister}>
            Export register
          </Button>
          <label className={buttonClass('secondary', 'md')}>
            Import register
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                e.currentTarget.value = '';
                if (file) void importFile(file);
              }}
            />
          </label>
        </div>
        {message && (
          <div className="mt-3">
            <Notice kind={message.kind} title={message.kind === 'success' ? 'Done' : 'Not done'} role={message.kind === 'error' ? 'alert' : 'status'}>
              <p>{message.text}</p>
            </Notice>
          </div>
        )}
      </Card>

      <NewJobDialog
        open={creating}
        onCancel={() => setCreating(false)}
        onCreate={(input) => {
          const job = newJob(input, jobs, today);
          register.update((all) => addJob(all, job));
          setCreating(false);
          setOpenId(job.id);
        }}
      />

      {openJob && (
        <JobDialog
          key={openJob.id}
          job={openJob}
          onUpdate={(patch) => register.update((all) => updateJob(all, openJob.id, patch, today))}
          onMove={(stage) => register.update((all) => moveStage(all, openJob.id, stage, today))}
          onLog={(kind, text) => register.update((all) => addLogEntry(all, openJob.id, kind, text, today))}
          onDelete={() => {
            register.update((all) => removeJob(all, openJob.id));
            setOpenId(null);
          }}
          onClose={() => setOpenId(null)}
        />
      )}

      <Dialog
        title="Replace the register?"
        open={pendingImport !== null}
        onClose={() => setPendingImport(null)}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={() => setPendingImport(null)}>Keep what is here</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!pendingImport) return;
                register.replace(pendingImport.jobs);
                setMessage({ kind: 'success', text: `Replaced the register with ${pendingImport.jobs.length} job${pendingImport.jobs.length === 1 ? '' : 's'} from ${pendingImport.fileName}.` });
                setPendingImport(null);
              }}
            >
              Replace
            </Button>
          </div>
        }
      >
        <p className="text-sm text-[var(--color-ink-2)]">
          {pendingImport
            ? `This browser holds ${jobs.length} job${jobs.length === 1 ? '' : 's'}. ${pendingImport.fileName} holds ${pendingImport.jobs.length}. Importing replaces everything here with the file. Export the current register first if you may need it.`
            : ''}
        </p>
      </Dialog>
    </div>
  );
}
