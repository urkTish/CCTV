// @vitest-environment jsdom
/**
 * Picture sections in the DOM: the editor (add, reorder with the keyboard,
 * duplicate, delete with Undo, upload with the location data removed), the
 * proposal's Concept chapter (Title → Picture → Description, labelled), and
 * the completion report made from the proposal in one click.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within, waitFor } from '@testing-library/react';
import { useState } from 'react';

import App from '../../App.tsx';
import { serializeRenovationIntake } from '../../renovation/intake.ts';
import { hasExif } from '../../renovation/photos.ts';
import { jpegWithGps, THREE_ROOM_PHOTOS, threeRoomAnswers } from '../../renovation/testFixtures.ts';
import type { PictureSection } from '../pictureSection.ts';
import { PictureSectionEditor } from './PictureSectionEditor.tsx';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});

let latest: PictureSection[] = [];
function Harness({ kind = 'concept' as const }: { kind?: 'concept' | 'actual' }) {
  const [list, setList] = useState<PictureSection[]>([]);
  latest = list;
  return (
    <PictureSectionEditor
      sections={list}
      onChange={(fn) => setList((l) => fn([...l]))}
      kind={kind}
      noun={kind === 'concept' ? 'concept section' : 'item'}
      rooms={[{ id: 'room-1', name: 'Living room' }]}
      scopeOptions={[{ ref: '1.01', text: 'Paint walls (Living room)' }]}
      lang="en"
      today="2026-10-12"
    />
  );
}

const titles = () => screen.getAllByRole('textbox', { name: /^Title of concept section \d+$/ }).map((i) => (i as HTMLInputElement).value);

describe('picture-section editor', () => {
  it('adds sections, focusing the new title, and reorders them with the keyboard', async () => {
    render(<Harness />);
    expect(screen.getByText('No concept sections yet')).toBeTruthy();
    for (const t of ['Hall', 'Kitchen', 'Terrace']) {
      fireEvent.click(screen.getAllByRole('button', { name: 'Add concept section' })[0]!);
      const inputs = screen.getAllByRole('textbox', { name: /^Title of concept section \d+$/ });
      const last = inputs[inputs.length - 1]!;
      await waitFor(() => expect(document.activeElement).toBe(last));
      fireEvent.change(last, { target: { value: t } });
    }
    expect(titles()).toEqual(['Hall', 'Kitchen', 'Terrace']);
    // The first section cannot move up; the last cannot move down.
    expect((screen.getByRole('button', { name: 'Move concept section 1 up' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Move concept section 3 down' }) as HTMLButtonElement).disabled).toBe(true);

    // Button (Enter / Space on a focused button): Terrace up one; focus follows the moved section.
    const up = screen.getByRole('button', { name: 'Move concept section 3 up' });
    up.focus();
    fireEvent.click(up);
    expect(titles()).toEqual(['Hall', 'Terrace', 'Kitchen']);
    expect(screen.getByRole('status').textContent).toBe('Moved “Terrace” to position 2 of 3.');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Move concept section 2 up' })));

    // Alt + ↑ from inside a card: Terrace to the top, focus stays in its title.
    const terrace = screen.getAllByRole('textbox', { name: /^Title of concept section \d+$/ })[1]!;
    fireEvent.keyDown(terrace, { key: 'ArrowUp', altKey: true });
    expect(titles()).toEqual(['Terrace', 'Hall', 'Kitchen']);
    await waitFor(() => expect((document.activeElement as HTMLInputElement).value).toBe('Terrace'));
    // Alt + ↓ twice: back to the bottom; a third press does nothing.
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown', altKey: true });
    await waitFor(() => expect(titles()).toEqual(['Hall', 'Terrace', 'Kitchen']));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown', altKey: true });
    await waitFor(() => expect(titles()).toEqual(['Hall', 'Kitchen', 'Terrace']));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown', altKey: true });
    expect(titles()).toEqual(['Hall', 'Kitchen', 'Terrace']);
    // A plain arrow key does not move anything.
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    expect(titles()).toEqual(['Hall', 'Kitchen', 'Terrace']);
  });

  it('duplicates, deletes with Undo, and links a room and a BOQ line', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Add the first concept section' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Title of concept section 1' }), { target: { value: 'Hall' } });
    fireEvent.change(screen.getByLabelText('Room or area'), { target: { value: 'room-1' } });
    fireEvent.change(screen.getByLabelText('BOQ item or scope line'), { target: { value: '1.01' } });
    expect(latest[0]).toMatchObject({ roomId: 'room-1', scopeRef: '1.01', scopeText: 'Paint walls (Living room)' });
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate concept section 1' }));
    expect(titles()).toEqual(['Hall', 'Hall (copy)']);
    fireEvent.click(screen.getByRole('button', { name: 'Delete concept section 1' }));
    expect(titles()).toEqual(['Hall (copy)']);
    expect(screen.getByText('Concept section “Hall” deleted')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(titles()).toEqual(['Hall', 'Hall (copy)']);
    expect(screen.queryByText('Concept section “Hall” deleted')).toBeNull();
  });

  it('bullets toggle on the description, and an uploaded picture loses its location data', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Add the first concept section' }));
    const desc = screen.getByLabelText('Description') as HTMLTextAreaElement;
    fireEvent.change(desc, { target: { value: 'Warm light\nStone floor' } });
    desc.setSelectionRange(0, desc.value.length);
    fireEvent.click(screen.getByRole('button', { name: 'Bullet list in concept section 1' }));
    expect(latest[0]!.description).toBe('- Warm light\n- Stone floor');

    const file = new File([jpegWithGps(1200, 900)], 'render.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('Add pictures to concept section 1'), { target: { files: [file] } });
    await waitFor(() => expect(latest[0]!.images).toHaveLength(1));
    const im = latest[0]!.images[0]!;
    expect(im).toMatchObject({ role: 'main', takenOn: null, metadataStripped: true, widthPx: 1200 });
    expect(hasExif(Uint8Array.from(atob(im.dataUri.split(',')[1]!), (c) => c.charCodeAt(0)))).toBe(false);
    expect(screen.getByText('Concept / Illustrative')).toBeTruthy();
    // Not an image: a clear error, nothing added.
    fireEvent.change(screen.getByLabelText('Add pictures to concept section 1'), { target: { files: [new File(['hello'], 'notes.txt', { type: 'text/plain' })] } });
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/notes.txt is not a JPEG or PNG/));
    expect(latest[0]!.images).toHaveLength(1);
  });

  it('evidence photos get a role and a date taken; Mark done sets the date', async () => {
    render(<Harness kind="actual" />);
    fireEvent.click(screen.getByRole('button', { name: 'Add the first item' }));
    const file = new File([jpegWithGps()], 'after.jpg', { type: 'image/jpeg', lastModified: Date.UTC(2026, 9, 20, 12) });
    fireEvent.change(screen.getByLabelText('Add pictures to item 1'), { target: { files: [file] } });
    await waitFor(() => expect(latest[0]!.images).toHaveLength(1));
    expect(latest[0]!.images[0]).toMatchObject({ role: 'before', takenOn: '2026-10-20' });
    expect(screen.getByText('Actual photo — before · 20 Oct 2026')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Shows'), { target: { value: 'after' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mark done' }));
    expect(latest[0]).toMatchObject({ status: 'done', doneOn: '2026-10-12' });
    expect(latest[0]!.images[0]!.role).toBe('after');
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

describe('Admin: Concept chapter and completion report', () => {
  it('a concept section prints in the proposal as Title, then Picture, then Description, labelled', async () => {
    await openIntake();
    expect(within(nav()).getByRole('button', { name: /^Concepts/ }).textContent).toMatch(/Optional/);
    goTo('Concepts');
    fireEvent.click(screen.getByRole('button', { name: 'Add the first concept section' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Title of concept section 1' }), { target: { value: 'Feature wall in the living room' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'A warm limewash wall.\n\n- Indirect light\n- Oak shelf' } });
    fireEvent.change(screen.getByLabelText('Add pictures to concept section 1'), { target: { files: [new File([jpegWithGps()], 'render.jpg', { type: 'image/jpeg' })] } });
    await waitFor(() => expect(screen.getAllByRole('img', { name: /concept section 1, picture 1/i })).toHaveLength(1));
    expect(within(nav()).getByRole('button', { name: /^Concepts/ }).textContent).toMatch(/1 section/);

    goTo('Proposal');
    const report = screen.getByRole('article', { name: 'Renovation proposal' });
    expect(within(report).getByRole('heading', { level: 2, name: /Concept$/ })).toBeTruthy();
    const plate = within(report).getByRole('region', { name: 'Concept 1: Feature wall in the living room' });
    const title = within(plate).getByRole('heading', { level: 3 });
    const picture = within(plate).getByRole('img', { name: /Concept, illustrative/ });
    const bullet = within(plate).getByText('Indirect light');
    // Document order: title, then picture, then description.
    expect(title.compareDocumentPosition(picture) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(picture.compareDocumentPosition(bullet) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // jsdom has no canvas, so the label is laid over the picture instead of burned in: never missing.
    expect(within(plate).getByTestId('picture-label').textContent).toBe('Concept / Illustrative');
    expect(picture.getAttribute('data-label-burned')).toBe('false');
  });

  it('one click creates the completion report from the proposal; items are marked done or snag; Final waits', async () => {
    await openIntake();
    goTo('Completion report');
    expect(screen.getByText('The proposal is still a draft')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Create completion report from the proposal' }));
    const items = screen.getByRole('list', { name: 'Items' });
    const cards = within(items).getAllByRole('listitem', { name: /^Item \d+:/ });
    expect(cards.length).toBeGreaterThanOrEqual(2);
    // Pre-filled from the proposal: titles and the room's before photo.
    expect((screen.getByRole('textbox', { name: 'Title of item 1' }) as HTMLInputElement).value).toMatch(/— works$/);
    expect(within(cards[0]!).getAllByText(/^Actual photo — before/).length).toBe(1);
    expect(within(nav()).getByRole('button', { name: /^Completion report/ }).textContent).toMatch(/0 of \d+ done/);

    // Item 1: add the after photo and mark it done. Item 2: snag.
    fireEvent.change(screen.getByLabelText('Add pictures to item 1'), { target: { files: [new File([jpegWithGps()], 'after.jpg', { type: 'image/jpeg', lastModified: Date.UTC(2026, 10, 2, 12) })] } });
    await waitFor(() => expect(within(cards[0]!).getAllByText(/^Actual photo — after · 2 Nov 2026/).length).toBe(1));
    fireEvent.click(within(cards[0]!).getByRole('button', { name: 'Mark done' }));
    fireEvent.click(within(cards[1]!).getByRole('button', { name: 'Mark as snag' }));
    expect(within(nav()).getByRole('button', { name: /^Completion report/ }).textContent).toMatch(/1 of \d+ done · 1 snag/);

    const report = screen.getByRole('article', { name: 'Completion report' });
    expect(report.getAttribute('data-status')).toBe('draft');
    expect(within(report).getByText('DRAFT — NOT FOR APPROVAL', { selector: '.report-draft-ribbon' })).toBeTruthy();
    const done = within(report).getByRole('region', { name: /^Item 1:/ });
    expect(within(done).getByText('Done')).toBeTruthy();
    expect(within(done).getByText(/^Completed:/)).toBeTruthy();
    expect(within(report).getByRole('heading', { level: 2, name: /Outstanding snags/ })).toBeTruthy();
    expect(within(report).getAllByText(/^Item 2 — /).length).toBe(1);
    expect(within(report).queryByTestId('company-stamp')).toBeNull();

    // Final is blocked while items are open and names are missing.
    fireEvent.click(screen.getByRole('button', { name: 'Issue as final…' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getAllByText(/still in progress — mark it done/).length).toBeGreaterThan(0);
    fireEvent.click(within(dialog).getByRole('checkbox'));
    expect((within(dialog).getByRole('button', { name: 'Issue final report with stamp' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
