// @vitest-environment jsdom
/**
 * The Admin shell (U4–U9): navigation with a status per section, previous /
 * next, the list → detail locations, the Advanced disclosures, the overview's
 * linked warnings, the jump palette and the BOM prices.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';

import App from '../../App.tsx';

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});
afterEach(cleanup);

const nav = () => screen.getByRole('navigation', { name: 'Project sections' });
function goTo(section: string) {
  fireEvent.click(within(nav()).getByRole('button', { name: new RegExp(`^${section.replace(/[()&]/g, '\\$&')}`) }));
}

describe('Admin navigation', () => {
  it('lists the workflow with a status on every section, and starts on the Overview', () => {
    render(<App />);
    const items = within(nav()).getAllByRole('button').map((b) => b.textContent ?? '');
    for (const label of ['Overview', 'Site map', 'Locations & cameras', 'Recording & storage', 'Network (switches)', 'Cabling', 'Bill of materials', 'Settings']) {
      expect(items.some((t) => t.startsWith(label))).toBe(true);
    }
    // Status is text, not colour alone.
    expect(within(nav()).getByRole('button', { name: /^Site map/ }).textContent).toMatch(/Not started: No plan yet/);
    expect(within(nav()).getByRole('button', { name: /^Overview/ }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('heading', { level: 2, name: 'Overview' })).toBeTruthy();
  });

  it('moves through the sections with Next and Previous, and focuses the new heading', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^Next: Site map/ }));
    const h = screen.getByRole('heading', { level: 2, name: 'Site map' });
    expect(document.activeElement).toBe(h);
    fireEvent.click(screen.getByRole('button', { name: /^Next: Locations & cameras/ }));
    expect(screen.getByRole('heading', { level: 2, name: 'Locations & cameras' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Previous: Site map/ }));
    expect(screen.getByRole('heading', { level: 2, name: 'Site map' })).toBeTruthy();
  });

  it('collapses the navigation to icons, keeping every label for assistive technology', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Collapse navigation' }));
    expect(screen.getByRole('button', { name: 'Expand navigation' })).toBeTruthy();
    expect(within(nav()).getByRole('button', { name: /^Cabling/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Expand navigation' }));
  });
});

describe('Locations: list → detail', () => {
  it('shows each location with its camera and verdict, and opens its detail', () => {
    render(<App />);
    goTo('Locations & cameras');
    fireEvent.click(screen.getByRole('button', { name: 'Add location' }));
    const list = screen.getByRole('list', { name: 'Locations' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]!.textContent).toMatch(/Main gate×1DS-/);
    expect(rows[0]!.textContent).toMatch(/Pass|Marginal|Fail/);
    // The new location is selected and its inputs are shown.
    expect((screen.getByLabelText('Name', { selector: 'input' }) as HTMLInputElement).value).toBe('Location 2');
    fireEvent.click(within(rows[0]!).getAllByRole('button')[0]!);
    expect((screen.getByLabelText('Name', { selector: 'input' }) as HTMLInputElement).value).toBe('Main gate');
    fireEvent.click(screen.getByRole('button', { name: 'Next location' }));
    expect((screen.getByLabelText('Name', { selector: 'input' }) as HTMLInputElement).value).toBe('Location 2');
  });

  it('keeps rarely changed inputs under Advanced, and says when one differs from its default', () => {
    render(<App />);
    goTo('Locations & cameras');
    expect(screen.getAllByText('all at defaults').length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText(/Height of what you are looking at/, { selector: 'input' }), { target: { value: '0.5' } });
    expect(screen.getByText('1 changed from default')).toBeTruthy();
  });

  it('marks a tab that holds an input error', () => {
    render(<App />);
    goTo('Locations & cameras');
    fireEvent.change(screen.getByLabelText(/Mounting height/, { selector: 'input' }), { target: { value: '0' } });
    expect(screen.getByRole('tab', { name: /Geometry.*1 error/ })).toBeTruthy();
  });
});

describe('Overview', () => {
  it('lists open warnings, each linking to where it is fixed', () => {
    render(<App />);
    const list = screen.getByRole('list', { name: 'Open warnings' });
    const first = within(list).getAllByRole('listitem')[0]!;
    const link = within(first).getByRole('button');
    expect(link.textContent).toMatch(/^Open Main gate|^Go to /);
    fireEvent.click(link);
    expect(screen.queryByRole('heading', { level: 2, name: 'Overview' })).toBeNull();
  });

  it('edits the project name', () => {
    render(<App />);
    const field = screen.getByLabelText('Project name') as HTMLInputElement;
    // Cleared while retyping: the field stays empty, the project keeps a name.
    fireEvent.change(field, { target: { value: '' } });
    expect(field.value).toBe('');
    expect(screen.getByText('New project', { selector: 'header p' })).toBeTruthy();
    fireEvent.change(field, { target: { value: 'Harbour depot' } });
    expect(screen.getByText('Harbour depot', { selector: 'header p' })).toBeTruthy();
  });
});

describe('Jump palette', () => {
  it('opens with Ctrl K and jumps to a location by name', () => {
    render(<App />);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const dialog = screen.getByRole('dialog', { name: 'Jump to' });
    fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: 'main' } });
    expect(within(dialog).getAllByRole('option')[0]!.textContent).toMatch(/Main gate/);
    fireEvent.keyDown(within(dialog).getByRole('combobox'), { key: 'Enter' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Locations & cameras' })).toBeTruthy();
  });

  it('says so when nothing matches', () => {
    render(<App />);
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    fireEvent.change(within(screen.getByRole('dialog')).getByRole('combobox'), { target: { value: 'zzz' } });
    expect(screen.getByText(/Nothing matches/)).toBeTruthy();
  });
});

describe('Bill of materials', () => {
  it('lists every line and totals only the prices the engineer typed', () => {
    render(<App />);
    goTo('Bill of materials');
    const table = screen.getByRole('table', { name: 'Bill of materials' });
    const rows = within(table).getAllByRole('row');
    expect(rows.length).toBeGreaterThan(3);
    expect(screen.getByText(/0 of \d+ lines priced/)).toBeTruthy();
    const price = within(table).getAllByLabelText(/^Unit price for /)[0] as HTMLInputElement;
    fireEvent.change(price, { target: { value: '120' } });
    expect(screen.getByText(/1 of \d+ lines priced/)).toBeTruthy();
    expect(screen.getAllByText('120.00').length).toBeGreaterThan(0);
  });
});

describe('Camera finder', () => {
  it('lists cameras compatible with a chosen recorder, and the nearest ones when nothing fits', () => {
    render(<App />);
    fireEvent.click(within(nav()).getByRole('button', { name: /^Camera finder/ }));
    expect(screen.getByRole('heading', { level: 2, name: 'Camera finder' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Recorder (NVR)'), { target: { value: 'ds-9632ni-m8' } });
    fireEvent.change(screen.getByLabelText('Lens'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Minimum resolution'), { target: { value: '8' } });
    expect(screen.getByRole('heading', { name: /compatible camera/ })).toBeTruthy();
    expect(screen.getAllByText(/8 MP · 4 mm/).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText('Minimum resolution'), { target: { value: '12' } });
    expect(screen.getByRole('heading', { name: 'No camera meets every requirement' })).toBeTruthy();
    expect(screen.getByText(/highest resolution is 8 MP/)).toBeTruthy();
  });
});
