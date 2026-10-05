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

/** Open an Admin section from the navigation. */
function goTo(section: string) {
  const nav = screen.getByRole('navigation', { name: 'Project sections' });
  fireEvent.click(within(nav).getByRole('button', { name: new RegExp(`^${section.replace(/[()&]/g, '\\$&')}`) }));
}

/** The section's content (everything under its h2). */
function sectionContent(): HTMLElement {
  return screen.getByRole('main');
}

describe('system design results (N1)', () => {
  it('renders storage, the recorder with its checks, switching and the cable plan', () => {
    render(<App />);
    const expected = designProject(defaultProject());
    const nvr = expected.nvr!.primary!.evaluation.nvr;

    goTo('Recording & storage');
    let card = sectionContent();
    expect(within(card).getByText('Usable capacity needed after formatting:')).toBeTruthy();
    expect(within(card).getAllByText(nvr.model).length).toBeGreaterThan(0);
    expect(within(card).getByRole('table', { name: `Recorder checks for ${nvr.model}` })).toBeTruthy();
    expect(within(card).getAllByText('Unverified').length).toBeGreaterThan(0);
    // One camera on a 49 m placeholder: built-in PoE, no switch.
    goTo('Network (switches)');
    expect(within(sectionContent()).getByText(/No external switch needed/)).toBeTruthy();
    goTo('Cabling');
    card = sectionContent();
    expect(within(card).getByText('Boxes to buy')).toBeTruthy();
    expect(within(card).getByRole('table', { name: 'Cable runs' })).toBeTruthy();
    expect(within(card).getAllByText('Unverified').length).toBeGreaterThan(0);

    // The project totals show the same recorder.
    goTo('Overview');
    expect(screen.getByText('Recorder', { selector: 'dt' }).nextElementSibling?.textContent).toBe(nvr.model);
  });

  it('follows the design settings: an external switch is sized when chosen', () => {
    render(<App />);
    goTo('Recording & storage');
    fireEvent.change(screen.getByLabelText('Camera power'), { target: { value: 'external' } });
    goTo('Network (switches)');
    const card = sectionContent();
    expect(within(card).getByText(/1 switch at 1 point/)).toBeTruthy();
    expect(within(card).getByText(/Cameras: Main gate \(/)).toBeTruthy();
    goTo('Overview');
    expect(screen.getByText('PoE switches', { selector: 'dt' }).nextElementSibling?.textContent).toBe('1');
  });

  it('follows the design settings: RAID 5 changes the recorder RAID requirement', () => {
    render(<App />);
    goTo('Recording & storage');
    // Every RAID recorder in the catalogue (DS-96xx) has no built-in PoE, so power the camera from a switch.
    fireEvent.change(screen.getByLabelText('Camera power'), { target: { value: 'external' } });
    fireEvent.change(screen.getByLabelText('RAID level'), { target: { value: '5' } });
    const card = sectionContent();
    const raidRow = within(card).getAllByRole('rowheader', { name: 'RAID' })[0]!.closest('tr')!;
    expect(raidRow.textContent).toMatch(/RAID 5/);
  });

  it('clamps an out-of-range setting so the link still reopens', () => {
    render(<App />);
    goTo('Recording & storage');
    const growth = screen.getByLabelText(/Growth headroom/, { selector: 'input' }) as HTMLInputElement;
    fireEvent.change(growth, { target: { value: '9999' } });
    // The typed text stays while editing (NumberInput); the clamped value shows on blur.
    fireEvent.blur(growth);
    expect(growth.value).toBe('500');
  });
});
