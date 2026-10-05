// @vitest-environment jsdom
/**
 * The report in Admin (U16): every section, the 15-field tables, prices only
 * when entered, QR codes, and the company stamp only on a report deliberately
 * made Final behind the confirmation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';

import App from '../App.tsx';
import { CARD_FIELD_ORDER } from '../engine/outputCard.ts';

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});
afterEach(cleanup);

function goTo(section: string) {
  const nav = screen.getByRole('navigation', { name: 'Project sections' });
  fireEvent.click(within(nav).getByRole('button', { name: new RegExp(`^${section.replace(/[()&]/g, '\\$&')}`) }));
}
const report = () => screen.getByRole('article', { name: 'Client report' });

describe('client report', () => {
  it('has the cover and the eight sections, a running header and the 15 fields in order', () => {
    render(<App />);
    goTo('Report');
    const r = report();
    expect(within(r).getByRole('heading', { level: 1, name: 'CCTV system proposal' })).toBeTruthy();
    const titles = within(r).getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titles).toEqual([
      '1Summary',
      '2Site map',
      '3Camera for each area',
      '4Recording, network and cabling',
      '5Bill of materials',
      '6Datasheets',
      '7Assumptions and notes',
      '8Approval',
    ]);
    expect(within(r).getAllByAltText('ContracTech').length).toBeGreaterThanOrEqual(2); // running header + cover
    const spec = within(r).getByRole('table', { name: /^Specification for / });
    expect(within(spec).getAllByRole('rowheader').map((th) => th.textContent)).toEqual([...CARD_FIELD_ORDER]);
    expect(within(r).getAllByRole('img', { name: /^QR code for the / }).length).toBeGreaterThan(0);
  });

  it('shows price columns only when the engineer has entered a price', () => {
    render(<App />);
    goTo('Report');
    expect(within(report()).queryByText(/Unit price/)).toBeNull();
    expect(within(report()).getByText('Prices are quoted separately.')).toBeTruthy();
    goTo('Bill of materials');
    fireEvent.change(screen.getAllByLabelText(/^Unit price for /)[0]!, { target: { value: '250' } });
    goTo('Report');
    expect(within(report()).getByText(/Unit price/)).toBeTruthy();
  });

  it('a draft has the watermark and no stamp; Final needs a deliberate confirmation and then carries the stamp', () => {
    render(<App />);
    goTo('Report');
    expect(report().getAttribute('data-status')).toBe('draft');
    expect(within(report()).getAllByText('DRAFT — NOT FOR APPROVAL').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('company-stamp')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Issue as final…' }));
    const dialog = screen.getByRole('dialog', { name: 'Issue the final report?' });
    const issue = within(dialog).getByRole('button', { name: 'Issue final report with stamp' }) as HTMLButtonElement;
    expect(issue.disabled).toBe(true);
    // What is still open is listed (no engineer name, no client name here).
    expect(within(dialog).getByText(/Your name is not set/)).toBeTruthy();
    // Cancelling changes nothing.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByTestId('company-stamp')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Issue as final…' }));
    const d2 = screen.getByRole('dialog', { name: 'Issue the final report?' });
    fireEvent.click(within(d2).getByLabelText(/I have reviewed this proposal/));
    fireEvent.click(within(d2).getByRole('button', { name: 'Issue final report with stamp' }));
    expect(report().getAttribute('data-status')).toBe('final');
    const stamp = screen.getByTestId('company-stamp');
    expect(stamp.getAttribute('alt')).toBe('ContracTech company stamp');
    expect(stamp.className).toBe('report-stamp');
    expect(within(report()).queryAllByText('DRAFT — NOT FOR APPROVAL')).toHaveLength(0);

    // Back to draft removes it.
    fireEvent.click(screen.getByRole('button', { name: 'Return to draft' }));
    expect(screen.queryByTestId('company-stamp')).toBeNull();
  });
});
