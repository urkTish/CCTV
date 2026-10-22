// @vitest-environment jsdom
/**
 * Renovation Phase 1 in the DOM: the client start page and the bilingual
 * wizard (with a photo whose GPS data is stripped), the handoff to Admin as a
 * draft with assumed values flagged, the line switcher, the survey's safety
 * gate on Final, the library, the quantities trace and the proposal.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within, act, waitFor } from '@testing-library/react';

import App from '../../App.tsx';
import { parseRenovationIntake, serializeRenovationIntake } from '../intake.ts';
import { hasExif } from '../photos.ts';
import { jpegWithGps, THREE_ROOM_PHOTOS, threeRoomAnswers } from '../testFixtures.ts';

let saved = '';
beforeEach(() => {
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
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

const flush = () => act(async () => new Promise((r) => setTimeout(r, 0)));
const next = () => fireEvent.click(screen.getByRole('button', { name: /^(Next|Skip|التالي|تخطٍّ)/ }));
const choose = (text: string) => fireEvent.click(screen.getByText(text, { exact: true }));

describe('client start page (#/client)', () => {
  it('offers the services with CCTV first, links the wizards, and says Build / Fix are not built yet', () => {
    window.history.replaceState(null, '', '/#/client');
    render(<App />);
    const links = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(links.slice(0, 2)).toEqual(['#/client/cctv', '#/client/renovation']);
    fireEvent.click(screen.getByRole('button', { name: /^Build/ }));
    expect(screen.getByRole('status').textContent).toMatch(/Coming soon/);
    fireEvent.click(screen.getByRole('button', { name: 'العربية' }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('كيف يمكننا مساعدتك؟');
    expect(document.querySelector('[dir="rtl"]')).not.toBeNull();
  });
});

describe('renovation wizard (#/client/renovation)', () => {
  it('walks 8 steps with validation, strips photo GPS, and saves an intake file Admin can read', async () => {
    window.history.replaceState(null, '', '/#/client/renovation');
    render(<App />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toBe('Step 1 of 8: About you and the place');
    next();
    expect(screen.getByRole('alert').textContent).toMatch(/phone number/);
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Sara' } });
    fireEvent.change(screen.getByLabelText(/^Phone/), { target: { value: '+966 50 123 4567' } });
    choose('Villa / house');
    next();
    next();
    expect(screen.getByRole('alert').textContent).toMatch(/at least one thing/);
    choose('Repaint');
    choose('New floors');
    next();
    // Rooms
    next();
    expect(screen.getByRole('alert').textContent).toMatch(/at least one room/);
    fireEvent.click(screen.getByRole('button', { name: 'Add a room' }));
    choose('Living room');
    fireEvent.change(screen.getByLabelText('What do you call it?'), { target: { value: 'Majlis corner' } });
    choose('Large');
    const file = new File([jpegWithGps(2000, 1500)], 'IMG_0001.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText(/^Add photos: /), { target: { files: [file] } });
    await waitFor(() => expect(screen.getAllByRole('img', { name: /Majlis corner 1/ })).toHaveLength(1));
    fireEvent.change(screen.getByLabelText('Taken from'), { target: { value: 'From the window' } });
    choose('Cracks');
    fireEvent.click(screen.getByRole('button', { name: 'Save this room' }));
    expect(within(screen.getByRole('list', { name: 'Your rooms' })).getByText('Majlis corner')).toBeTruthy();
    next();
    // Style quiz
    next();
    expect(screen.getByRole('alert').textContent).toMatch(/style, a colour palette and one feeling/);
    choose('Contemporary Arabic');
    choose('Earthy');
    choose('Calm');
    next();
    choose('Premium finish');
    next();
    choose('As soon as possible');
    next();
    next(); // plan skipped
    // Review: an indicative summary in m² and days, no price.
    expect(screen.getByText('Preliminary estimate')).toBeTruthy();
    expect(screen.getByRole('heading', { name: /m² of walls to paint/ })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/SAR \d/);
    // Consent is required to send photos.
    fireEvent.click(screen.getByRole('button', { name: 'Save my answers' }));
    expect(screen.getByRole('alert').textContent).toMatch(/agree to the use of your photos/);
    fireEvent.click(screen.getByText(/I agree that ContracTech may use these photos/));
    fireEvent.click(screen.getByRole('button', { name: 'Save my answers' }));
    await flush();
    const r = parseRenovationIntake(saved);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.intake.answers.place).toMatchObject({ name: 'Sara', propertyType: 'villa' });
    expect(r.intake.answers.rooms[0]).toMatchObject({ type: 'living', name: 'Majlis corner', size: { mode: 'class', cls: 'L' }, problems: ['cracks'] });
    expect(r.intake.answers.consent).toEqual({ photoUse: true, marketing: false });
    const p = r.intake.photos[0]!;
    expect(p.facing).toBe('From the window');
    expect(p.metadataStripped).toBe(true);
    expect(hasExif(Uint8Array.from(atob(p.dataUri.split(',')[1]!), (c) => c.charCodeAt(0)))).toBe(false);
    // Arabic, right to left
    fireEvent.click(screen.getByRole('button', { name: 'العربية' }));
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('المراجعة والإرسال');
    expect(document.querySelector('[dir="rtl"][lang="ar"]')).not.toBeNull();
  });

  it('keeps the answers in this browser across a reload', () => {
    window.history.replaceState(null, '', '/#/client/renovation');
    const first = render(<App />);
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Kept' } });
    first.unmount();
    render(<App />);
    expect((screen.getByLabelText('Your name') as HTMLInputElement).value).toBe('Kept');
  });
});

// ---------------------------------------------------------------------------

const nav = () => screen.getByRole('navigation', { name: 'Project sections' });
const goTo = (label: string) => fireEvent.click(within(nav()).getByRole('button', { name: new RegExp(`^${label.replace(/[()&]/g, '\\$&')}`) }));

async function openIntake() {
  render(<App />);
  const text = serializeRenovationIntake({ answers: threeRoomAnswers(), submittedOn: '2026-10-12', photos: THREE_ROOM_PHOTOS, planImage: null });
  const input = screen.getByText('Open project').closest('label')!.querySelector('input')!;
  fireEvent.change(input, { target: { files: [new File([text], 'renovation-request.json', { type: 'application/json' })] } });
  await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Renovation'));
}

describe('Admin: a renovation intake opens as a draft', () => {
  it('switches to the renovation line with its sections, and flags every assumed value', async () => {
    await openIntake();
    const items = within(nav()).getAllByRole('button').map((b) => b.textContent ?? '');
    for (const label of ['Overview', 'Client & intake', 'Site map', 'Survey', 'Specification', 'Library', 'Quantities', 'BOQ & programme', 'Visuals', 'Proposal']) {
      expect(items.some((t) => t.startsWith(label))).toBe(true);
    }
    expect(screen.getByText(/Draft from a client intake — 15 assumed values to confirm/)).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Service line' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Renovation' }).getAttribute('aria-pressed')).toBe('true');
    // Estimated range, subject to survey (Q8)
    expect(screen.getByText('Estimate (range)')).toBeTruthy();

    goTo('Survey');
    expect(screen.getAllByText('Assumed from client intake — please confirm').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm height' }));
    expect(screen.queryByRole('button', { name: 'Confirm height' })).toBeNull();
    // Typing a measured value also confirms it.
    fireEvent.change(screen.getAllByLabelText(/^Length/)[0]!, { target: { value: '5.2' } });
    expect(screen.queryByRole('button', { name: 'Confirm length and width' })).toBeNull();
    expect(screen.getByText(/A_f = L × W = 5.2 × 4 = 20.8 m²/)).toBeTruthy();
  });

  it('a blocking safety "Yes" without an action blocks issuing the proposal as Final', async () => {
    await openIntake();
    goTo('Survey');
    const live = within(screen.getByRole('list', { name: 'Safety checklist' })).getAllByRole('listitem')[0]!;
    fireEvent.click(within(live).getByText('Yes', { exact: true }));
    goTo('Proposal');
    fireEvent.click(screen.getByRole('button', { name: 'Issue as final…' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Exposed live conductors.*needs an action recorded/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('checkbox'));
    expect((within(dialog).getByRole('button', { name: 'Issue final proposal with stamp' }) as HTMLButtonElement).disabled).toBe(true);
    // The draft proposal: watermark, range, no stamp.
    const report = screen.getByRole('article', { name: 'Renovation proposal' });
    expect(report.getAttribute('data-status')).toBe('draft');
    expect(within(report).getByText(/Estimated range incl. VAT/)).toBeTruthy();
    expect(within(report).queryByTestId('company-stamp')).toBeNull();
  });

  it('shows the sample-rate warning in the Library, and every quantity with its trace', async () => {
    await openIntake();
    goTo('Library');
    expect(screen.getByText(/rates are SAMPLE rates — sample, replace with your rates/)).toBeTruthy();
    goTo('Quantities');
    expect(screen.getByText('Materials to order')).toBeTruthy();
    expect(screen.getAllByText('How this was calculated').length).toBeGreaterThan(10);
    expect(screen.getAllByText(/Boxes = ceil\(/).length).toBeGreaterThan(0);
    goTo('BOQ & programme');
    expect(screen.getByText('Total including VAT')).toBeTruthy();
    expect(screen.getByRole('img', { name: /Programme: \d+ activities/ })).toBeTruthy();
  });
});

describe('Admin: the line switcher on a CCTV project', () => {
  it('keeps the CCTV sections, and adds a renovation line to the same project on request', () => {
    render(<App />);
    expect(within(nav()).getByRole('button', { name: /^Locations & cameras/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Add renovation/ }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Renovation');
    expect(within(nav()).getByRole('button', { name: /^Survey/ })).toBeTruthy();
    expect(within(nav()).queryByRole('button', { name: /^Locations & cameras/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'CCTV' }));
    expect(within(nav()).getByRole('button', { name: /^Locations & cameras/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Renovation' })).toBeTruthy(); // now present on the project
  });
});
