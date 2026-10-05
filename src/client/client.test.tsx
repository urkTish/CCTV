// @vitest-environment jsdom
/**
 * The client intake wizard (U13) and the handoff to the engineer (U14): the
 * client's file opens in Admin as a draft, every assumed value is marked
 * "assumed from client intake — please confirm", and confirming or editing a
 * value clears its mark.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within, act } from '@testing-library/react';

import App from '../App.tsx';
import { ASSUMED_TEXT } from '../ui/AssumedFlag.tsx';
import { intakeLinkHash, parseIntakeFile, serializeIntakeFile } from './intakeFile.ts';
import { emptyAnswers, type ClientAnswers } from './intakeTypes.ts';

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

const next = () => fireEvent.click(screen.getByRole('button', { name: /^(Next|Skip)/ }));
const choose = (text: string) => fireEvent.click(screen.getByText(text, { exact: true }));

describe('client intake wizard', () => {
  it('walks six plain-language steps and saves an intake file the engine can read', async () => {
    window.history.replaceState(null, '', '/#/client');
    let saved = '';
    // jsdom has no object URLs; capture what would be downloaded.
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: (blob: Blob) => {
        void blob.text().then((t) => (saved = t));
        return 'blob:x';
      },
    });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => undefined });
    render(<App />);

    expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toBe('Step 1 of 6: About your site');
    choose('Warehouse or industrial site');
    fireEvent.change(screen.getByLabelText('Name of the site'), { target: { value: 'Northgate depot' } });
    next();

    // Step 2 refuses to go on without an area.
    next();
    expect(screen.getByRole('alert').textContent).toMatch(/at least one area/);
    fireEvent.click(screen.getByRole('button', { name: 'Add an area' }));
    fireEvent.change(screen.getByLabelText('What do you call this area?'), { target: { value: 'Main gate' } });
    fireEvent.click(screen.getByRole('button', { name: 'More: How many cameras here?' }));
    choose('Clearly identify faces');
    choose('Outdoors');
    choose('Yes — completely dark');
    choose('5 to 15 m');
    fireEvent.click(screen.getByRole('button', { name: 'Save this area' }));
    expect(within(screen.getByRole('list', { name: 'Your areas' })).getByText('Main gate')).toBeTruthy();
    next();

    // Step 3: retention, and the client's own recorder and power choices.
    choose('2 weeks');
    choose('In a network cabinet (rack)');
    choose('1.5U');
    choose('From a separate network switch');
    next();
    choose('Premium');
    next();
    next(); // floor plan: skipped

    // Step 6: an indicative summary, labelled preliminary, and how to send it.
    expect(screen.getByText('Preliminary estimate')).toBeTruthy();
    expect(screen.getByRole('heading', { name: /^2 cameras, .*sized for about 14 days of recordings$/ })).toBeTruthy();
    expect(screen.getByText(/preliminary until a ContracTech engineer confirms it with a site survey/)).toBeTruthy();
    expect(screen.getByText(/Send the file to your ContracTech engineer/)).toBeTruthy();
    // No engineering vocabulary anywhere on the client side.
    expect(document.body.textContent).not.toMatch(/px\/m|focal|DORI|PoE|IEC/);

    fireEvent.click(screen.getByRole('button', { name: 'Save my answers' }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    const r = parseIntakeFile(saved);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.intake.answers.site.siteName).toBe('Northgate depot');
    expect(r.intake.answers.areas).toEqual([
      { id: 'area-1', name: 'Main gate', cameraCount: 2, see: 'identify', place: 'outdoor', night: 'dark', distance: '5to15' },
    ]);
    expect(r.intake.answers.recording).toEqual({ retention: '2w', recorderPlace: 'cabinet', cabinetSpace: '1.5U', power: 'switch' });
    expect(r.intake.answers.budget).toBe('premium');
  });

  it('keeps the answers in this browser if the page is reloaded', () => {
    window.history.replaceState(null, '', '/#/client');
    const first = render(<App />);
    fireEvent.change(screen.getByLabelText('Name of the site'), { target: { value: 'Kept' } });
    first.unmount();
    render(<App />);
    expect((screen.getByLabelText('Name of the site') as HTMLInputElement).value).toBe('Kept');
  });
});

const sample: ClientAnswers = {
  ...emptyAnswers(),
  site: { premises: 'warehouse', siteName: 'Northgate depot', contactName: 'Sara Ahmed', contactPhone: '0500', contactEmail: '' },
  areas: [
    { id: 'a1', name: 'Main gate', cameraCount: 2, see: 'identify', place: 'outdoor', night: 'dark', distance: '5to15' },
    { id: 'a2', name: 'Yard', cameraCount: 1, see: 'activity', place: 'outdoor', night: 'some', distance: '15to30' },
  ],
  recording: { retention: '1m', recorderPlace: 'desk', cabinetSpace: 'any', power: 'recorder' },
};

function goTo(section: string) {
  const nav = screen.getByRole('navigation', { name: 'Project sections' });
  fireEvent.click(within(nav).getByRole('button', { name: new RegExp(`^${section.replace(/[()&]/g, '\\$&')}`) }));
}

describe('handoff to the engineer', () => {
  it('opens an intake file as a draft with every assumed value marked, and confirming clears the marks', async () => {
    window.history.replaceState(null, '', '/');
    render(<App />);
    const file = new File([serializeIntakeFile({ answers: sample, submittedOn: '2026-10-05', planImage: null })], 'cctv-request.json');
    fireEvent.change(screen.getByLabelText('Open project'), { target: { files: [file] } });
    expect(await screen.findByText(/is now a draft project\. 39 values were assumed/)).toBeTruthy();
    expect(screen.getByText(/Draft from a client intake — 39 assumed values to confirm/)).toBeTruthy();
    expect((screen.getByLabelText('Client') as HTMLInputElement).value).toBe('Sara Ahmed');
    expect((screen.getByLabelText('Project name') as HTMLInputElement).value).toBe('Northgate depot');

    goTo('Locations & cameras');
    expect(screen.getByText(/The client asked for: “Clearly identify faces” · 2 cameras/)).toBeTruthy();
    const marks = () => screen.queryAllByText(ASSUMED_TEXT);
    // Geometry tab: mounting height, distance, coverage mode, scene width + the two under Advanced.
    expect(marks().length).toBe(6);
    expect(screen.getByRole('tab', { name: /Environment.*5 to confirm/ })).toBeTruthy();

    // Confirming one clears it; editing another clears it too.
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Mounting height' }));
    expect(marks().length).toBe(5);
    fireEvent.change(screen.getByLabelText(/Distance to the furthest point of interest/, { selector: 'input' }), { target: { value: '12' } });
    expect(marks().length).toBe(4);

    // "Confirm all" for the location.
    fireEvent.click(screen.getByRole('button', { name: /^Confirm all 17 for Main gate/ }));
    expect(marks().length).toBe(0);

    // The client's recorder choices are kept and shown next to the engineer's inputs.
    goTo('Recording & storage');
    expect((screen.getByLabelText('Form factor') as HTMLSelectElement).value).toBe('desktop');
    expect((screen.getByLabelText('Camera power') as HTMLSelectElement).value).toBe('built-in');
    expect(screen.getByText(/Client’s answer in the intake: On a desk or a shelf/)).toBeTruthy();
    expect(screen.getByText(/Client’s answer in the intake: Straight from the recorder/)).toBeTruthy();
  });

  it('opens an intake link as a draft', () => {
    window.history.replaceState(null, '', `/${intakeLinkHash(sample, '2026-10-05')}`);
    render(<App />);
    expect(screen.getByText(/Opened the client intake “Northgate depot” as a draft project\. 39 values were assumed/)).toBeTruthy();
    // The link is replaced by the ordinary project link once opened.
    expect(window.location.hash.startsWith('#/intake/')).toBe(false);
  });

  it('a cut-short intake link starts a new project and says why', () => {
    window.history.replaceState(null, '', `/${intakeLinkHash(sample, null).slice(0, 30)}`);
    render(<App />);
    expect(screen.getByRole('alert').textContent).toMatch(/Starting from a new project instead/);
  });
});
