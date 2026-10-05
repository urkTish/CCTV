// @vitest-environment jsdom
/**
 * N1: the project-wide results render in the real App and follow the design
 * settings.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';

import App from '../App.tsx';
import { designProject } from '../engine/projectDesign.ts';
import { defaultProject } from '../state/projectTypes.ts';

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});
afterEach(cleanup);

function designCard(): HTMLElement {
  return screen.getByRole('heading', { name: 'System design' }).closest('section')!;
}

describe('system design results (N1)', () => {
  it('renders storage, the recorder with its checks, switching and the cable plan', () => {
    render(<App />);
    const card = designCard();
    const expected = designProject(defaultProject());
    const nvr = expected.nvr!.primary!.evaluation.nvr;

    expect(within(card).getByText('Usable capacity needed after formatting:')).toBeTruthy();
    expect(within(card).getAllByText(nvr.model).length).toBeGreaterThan(0);
    expect(within(card).getByRole('table', { name: `Recorder checks for ${nvr.model}` })).toBeTruthy();
    // One camera on a 49 m placeholder: built-in PoE, no switch.
    expect(within(card).getByText(/No external switch needed/)).toBeTruthy();
    expect(within(card).getByText('Boxes to buy')).toBeTruthy();
    expect(within(card).getByRole('table', { name: 'Cable runs' })).toBeTruthy();
    expect(within(card).getAllByText('Unverified').length).toBeGreaterThan(0);

    // The project totals show the same recorder.
    expect(screen.getByText('Recorder', { selector: 'dt' }).nextElementSibling?.textContent).toBe(nvr.model);
  });

  it('follows the design settings: an external switch is sized when chosen', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Camera power'), { target: { value: 'external' } });
    const card = designCard();
    expect(within(card).getByText(/1 switch at 1 point/)).toBeTruthy();
    expect(within(card).getByText(/Cameras: Main gate \(/)).toBeTruthy();
    expect(screen.getByText('PoE switches', { selector: 'dt' }).nextElementSibling?.textContent).toBe('1');
  });

  it('follows the design settings: RAID 5 changes the recorder RAID requirement', () => {
    render(<App />);
    // Every RAID recorder in the catalogue (DS-96xx) has no built-in PoE, so power the camera from a switch.
    fireEvent.change(screen.getByLabelText('Camera power'), { target: { value: 'external' } });
    fireEvent.change(screen.getByLabelText('RAID level'), { target: { value: '5' } });
    const card = designCard();
    const raidRow = within(card).getAllByRole('rowheader', { name: 'RAID' })[0]!.closest('tr')!;
    expect(raidRow.textContent).toMatch(/RAID 5/);
  });

  it('clamps an out-of-range setting so the link still reopens', () => {
    render(<App />);
    const growth = screen.getByLabelText(/Growth headroom/, { selector: 'input' }) as HTMLInputElement;
    fireEvent.change(growth, { target: { value: '9999' } });
    // The typed text stays while editing (NumberInput); the clamped value shows on blur.
    fireEvent.blur(growth);
    expect(growth.value).toBe('500');
  });
});
