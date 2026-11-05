// @vitest-environment jsdom
/**
 * Admin → Jobs, driven through the real app: opening it from the navigation,
 * creating a job, the attention list and the "due" count in the navigation,
 * stage moves (credit skips the transfer), export and import. Then the register
 * hook against a fake browser store: it loads first, saves every change, and
 * never saves over an unreadable register.
 */

import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import App from '../../App.tsx';
import { todayIso } from '../../client/intakeFile.ts';
import { addJob } from '../jobsState.ts';
import { newJob, parseJobs, serializeJobs } from '../model.ts';
import type { JobsStore } from '../store.ts';
import { useJobsRegister } from './useJobsRegister.ts';

let saved = '';
beforeEach(() => {
  window.history.replaceState(null, '', '/');
  localStorage.clear();
  saved = '';
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: (blob: Blob) => {
      void blob.text().then((t) => (saved = t));
      return 'blob:x';
    },
  });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => undefined });
});
afterEach(cleanup);

const today = todayIso();
const yesterday = todayIso(new Date(Date.now() - 86_400_000));
const firstId = `CT-${today.slice(2, 4)}-001`;

const nav = () => screen.getByRole('navigation', { name: 'Project sections' });
const openJobs = () => fireEvent.click(within(nav()).getByRole('button', { name: /^Jobs/ }));
const dialog = (name: string | RegExp) => screen.getByRole('dialog', { name });

function createJob(client: string, title: string) {
  fireEvent.click(screen.getByRole('button', { name: /^New job/ }));
  const d = dialog('New job');
  fireEvent.change(within(d).getByLabelText('Client'), { target: { value: client } });
  fireEvent.change(within(d).getByLabelText('Job'), { target: { value: title } });
  fireEvent.click(within(d).getByRole('button', { name: 'Create job' }));
}

describe('Admin → Jobs', () => {
  it('opens from the navigation, says the register is not saved without browser storage, and starts empty', () => {
    render(<App />);
    openJobs();
    expect(screen.getByRole('heading', { level: 2, name: 'Jobs' })).toBeTruthy();
    expect(screen.getByText('Not saved in this browser')).toBeTruthy();
    expect(screen.getByText('No jobs yet')).toBeTruthy();
  });

  it('creates a job, asks for a next step, then shows it overdue here and in the navigation', () => {
    render(<App />);
    openJobs();
    fireEvent.click(screen.getByRole('button', { name: /^New job/ }));
    fireEvent.click(within(dialog('New job')).getByRole('button', { name: 'Create job' }));
    expect(screen.getByText('Add the client and what the job is.')).toBeTruthy();
    fireEvent.change(within(dialog('New job')).getByLabelText('Client'), { target: { value: 'Al Noor Warehouse' } });
    fireEvent.change(within(dialog('New job')).getByLabelText('Job'), { target: { value: '12 cameras' } });
    fireEvent.click(within(dialog('New job')).getByRole('button', { name: 'Create job' }));

    // The new job opens straight away.
    const job = dialog(`${firstId} · Al Noor Warehouse`);
    fireEvent.click(within(job).getByRole('button', { name: 'Done' }));
    const attention = screen.getByRole('list', { name: 'Jobs that need attention' });
    expect(within(attention).getByText('No next step')).toBeTruthy();

    fireEvent.click(within(attention).getByRole('button', { name: `Open ${firstId}` }));
    const again = dialog(`${firstId} · Al Noor Warehouse`);
    fireEvent.change(within(again).getByLabelText('Next step'), { target: { value: 'Call Ahmed about the PO' } });
    fireEvent.change(within(again).getByLabelText('Due'), { target: { value: yesterday } });
    fireEvent.click(within(again).getByRole('button', { name: 'Done' }));

    expect(within(screen.getByRole('list', { name: 'Jobs that need attention' })).getByText('Overdue 1 day')).toBeTruthy();
    expect(screen.getByText('Call Ahmed about the PO', { selector: 'p' })).toBeTruthy();
    expect(within(nav()).getByRole('button', { name: /^Jobs/ }).textContent).toMatch(/1 due/);
  });

  it('moves a job along its stages, skipping the transfer on credit, and records each move', () => {
    render(<App />);
    openJobs();
    createJob('Mr Saleh', 'Villa renovation');
    const job = dialog(`${firstId} · Mr Saleh`);
    fireEvent.change(within(job).getByLabelText('Payment terms'), { target: { value: 'credit' } });
    fireEvent.change(within(job).getByLabelText('Stage'), { target: { value: 'awaiting-po' } });
    fireEvent.click(within(job).getByRole('button', { name: 'Move to Work in progress' }));
    const history = within(job).getByRole('list', { name: `History of ${firstId}` });
    expect(within(history).getByText('Moved to Waiting for PO.')).toBeTruthy();
    expect(within(history).getByText('Moved to Work in progress.')).toBeTruthy();
    expect(within(history).getByText('Enquiry recorded.')).toBeTruthy();
  });

  it('lays out for a phone: the client and job stack in one cell, and Delete sits apart from Done (browser check, 2026-11-05)', () => {
    render(<App />);
    openJobs();
    createJob('Al Noor Warehouse', '12 cameras');
    const job = dialog(`${firstId} · Al Noor Warehouse`);
    // The footer row spans the dialog, so justify-between puts Delete at the left and Done at the right.
    expect(within(job).getByRole('button', { name: /^Delete/ }).parentElement?.className).toMatch(/\bw-full\b/);
    fireEvent.click(within(job).getByRole('button', { name: 'Done' }));
    // stack-table lays a labelled cell out as label + one child; two children would sit side by side.
    const cell = document.querySelector('td[data-label="Client"]');
    expect(cell?.children).toHaveLength(1);
  });

  it('keeps the register while moving between sections', () => {
    render(<App />);
    openJobs();
    createJob('Al Noor Warehouse', '12 cameras');
    fireEvent.click(within(dialog(`${firstId} · Al Noor Warehouse`)).getByRole('button', { name: 'Done' }));
    fireEvent.click(within(nav()).getByRole('button', { name: /^Overview/ }));
    openJobs();
    expect(screen.getByText('1 job in the register.')).toBeTruthy();
  });

  it('exports the register, refuses a bad file, and replaces only after confirmation', async () => {
    render(<App />);
    openJobs();
    createJob('Al Noor Warehouse', '12 cameras');
    fireEvent.click(within(dialog(`${firstId} · Al Noor Warehouse`)).getByRole('button', { name: 'Done' }));

    fireEvent.click(screen.getByRole('button', { name: /^Export register/ }));
    await waitFor(() => expect(saved).toContain('"format": "contractech-jobs"'));
    expect(screen.getByText(`Exported 1 job as contractech-jobs-${today}.json.`)).toBeTruthy();

    const input = screen.getByLabelText('Import register');
    fireEvent.change(input, { target: { files: [new File(['{bad'], 'bad.json', { type: 'application/json' })] } });
    expect(await screen.findByText(/bad\.json was not imported\. The jobs file is not valid JSON/)).toBeTruthy();

    const a = newJob({ title: 'Network', client: 'School', service: 'network' }, [], '2026-10-01');
    const b = newJob({ title: 'Alarm', client: 'Clinic', service: 'alarm' }, [a], '2026-10-02');
    fireEvent.change(input, { target: { files: [new File([serializeJobs([a, b])], 'backup.json', { type: 'application/json' })] } });
    const confirm = await screen.findByRole('dialog', { name: 'Replace the register?' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Replace' }));
    expect(screen.getByText('2 jobs in the register.')).toBeTruthy();
    expect(screen.getByText(/Replaced the register with 2 jobs from backup\.json\./)).toBeTruthy();
  });
});

describe('the register hook', () => {
  function fakeStore(initial: string | null) {
    const store = {
      text: initial,
      saves: [] as string[],
      async load() {
        return store.text;
      },
      async save(t: string) {
        store.saves.push(t);
        store.text = t;
      },
    };
    return store satisfies JobsStore;
  }
  const one = newJob({ title: '12 cameras', client: 'Al Noor', service: 'cctv' }, [], '2026-11-01');

  it('loads the saved register first, ignores edits until then, and saves every change after', async () => {
    const store = fakeStore(serializeJobs([one]));
    const { result } = renderHook(() => useJobsRegister(store));
    expect(result.current.ready).toBe(false);
    act(() => result.current.update(() => []));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.jobs.map((j) => j.id)).toEqual([one.id]);
    expect(store.saves).toHaveLength(0);

    act(() => result.current.update((jobs) => addJob(jobs, newJob({ title: 'Alarm', client: 'Clinic', service: 'alarm' }, jobs, '2026-11-02'))));
    await waitFor(() => expect(store.saves).toHaveLength(1));
    const r = parseJobs(store.saves[0]!);
    expect(r.ok && r.jobs.map((j) => j.id)).toEqual([one.id, 'CT-26-002']);
    expect(result.current.status.kind).toBe('saved');
  });

  it('never saves over an unreadable register until a backup replaces it', async () => {
    const store = fakeStore('{"format":"contractech-jobs","v":1,"jobs":[{"id":1}]}');
    const { result } = renderHook(() => useJobsRegister(store));
    await waitFor(() => expect(result.current.status.kind).toBe('error'));
    act(() => result.current.update((jobs) => addJob(jobs, one)));
    await act(async () => {
      await Promise.resolve();
    });
    expect(store.saves).toHaveLength(0);
    act(() => result.current.replace([one]));
    await waitFor(() => expect(store.saves).toHaveLength(1));
    expect(result.current.status.kind).toBe('saved');
  });
});
