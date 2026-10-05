// @vitest-environment jsdom
/**
 * The shared components' keyboard and accessibility behaviour (U3).
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { useState } from 'react';

import { Advanced, Button, Dialog, StatusBadge, TabPanel, Tabs } from './primitives.tsx';

afterEach(cleanup);

function TabsHarness() {
  const [active, setActive] = useState<'a' | 'b' | 'c'>('a');
  return (
    <>
      <Tabs
        label="Demo"
        idBase="demo"
        tabs={[
          { id: 'a', label: 'Alpha' },
          { id: 'b', label: 'Beta' },
          { id: 'c', label: 'Gamma' },
        ]}
        active={active}
        onChange={setActive}
      />
      <TabPanel idBase="demo" id={active}>
        panel {active}
      </TabPanel>
    </>
  );
}

describe('Tabs', () => {
  it('follows the WAI-ARIA tabs pattern: one tab in the tab order, arrows / Home / End move and select', () => {
    render(<TabsHarness />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(tabs[0]!.id);

    fireEvent.keyDown(tabs[0]!, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { selected: true }).textContent).toBe('Beta');
    expect(document.activeElement?.textContent).toBe('Beta');
    expect(screen.getByRole('tabpanel').textContent).toBe('panel b');

    fireEvent.keyDown(screen.getByRole('tab', { selected: true }), { key: 'End' });
    expect(screen.getByRole('tab', { selected: true }).textContent).toBe('Gamma');
    fireEvent.keyDown(screen.getByRole('tab', { selected: true }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { selected: true }).textContent).toBe('Alpha');
    fireEvent.keyDown(screen.getByRole('tab', { selected: true }), { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { selected: true }).textContent).toBe('Gamma');
  });
});

function DialogHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open it</Button>
      <Dialog title="Confirm" open={open} onClose={() => setOpen(false)} footer={<Button onClick={() => setOpen(false)}>Done</Button>}>
        <p>Body</p>
      </Dialog>
    </>
  );
}

describe('Dialog', () => {
  it('is a labelled modal that takes focus, closes on Escape and gives focus back', () => {
    render(<DialogHarness />);
    const opener = screen.getByRole('button', { name: 'Open it' });
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Confirm' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});

describe('Advanced disclosure and status badge', () => {
  it('says how many advanced values differ from their defaults', () => {
    render(
      <>
        <Advanced changed={2}>
          <p>inside</p>
        </Advanced>
        <Advanced changed={0} label="Allowances">
          <p>inside</p>
        </Advanced>
      </>,
    );
    expect(screen.getByText('2 changed from default')).toBeTruthy();
    expect(screen.getByText('all at defaults')).toBeTruthy();
  });

  it('a status always carries text, not colour alone', () => {
    render(<StatusBadge kind="attention" />);
    expect(screen.getByText('Needs attention')).toBeTruthy();
  });
});
