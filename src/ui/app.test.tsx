// @vitest-environment jsdom
/**
 * UI smoke tests: the real App, rendered, driven through the controls a user
 * actually touches.
 *
 * These are not a substitute for looking at the thing in a browser — they say
 * nothing about layout, contrast or how the SVG reads. What they do assert is
 * that the app renders without throwing, that the client's fifteen fields appear
 * in the required order, that changing an input changes the verdict, that the
 * no-result path is reachable and informative, and that a shared link round-trips.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react';

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

import App from '../App.tsx';
import { APP_TITLE, COMPANY_NAME, LOGO_DARK_URL, LOGO_LIGHT_URL } from '../brand.ts';
import { CARD_FIELD_ORDER } from '../engine/outputCard.ts';
import { encodeProject, decodeProject, readStateFromHash } from '../state/urlState.ts';
import { defaultProject, defaultLocation, DEFAULT_GEOMETRY } from '../state/projectTypes.ts';

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});
afterEach(cleanup);

function setNumber(labelText: string | RegExp, value: string) {
  const input = screen.getByLabelText(labelText, { selector: 'input' });
  fireEvent.change(input, { target: { value } });
  return input;
}

/** Open an Admin section from the navigation. */
function goTo(section: string) {
  const nav = screen.getByRole('navigation', { name: 'Project sections' });
  fireEvent.click(within(nav).getByRole('button', { name: new RegExp(`^${section.replace(/[()&]/g, '\\$&')}`) }));
}

/** Render the app and open the active location's detail. */
function renderLocation() {
  const r = render(<App />);
  goTo('Locations & cameras');
  return r;
}

function tab(name: string | RegExp) {
  fireEvent.click(screen.getByRole('tab', { name }));
}

describe('App renders and responds', () => {
  it('renders the shell, the dataset count and the requirement panel', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/CCTV Design/);
    expect(screen.getByText(/models, every spec read from the manufacturer datasheet/)).toBeTruthy();
    goTo('Locations & cameras');
    expect(screen.getByText('Required pixel density')).toBeTruthy();
    tab('Calculation');
    expect(screen.getByText('What this location requires')).toBeTruthy();
    expect(screen.getByText('Required pixel density')).toBeTruthy();
  });

  it('shows a recommendation for the default scenario with the fifteen fields in order', () => {
    renderLocation();
    tab('Spec sheet');
    const tables = screen.getAllByRole('table');
    expect(tables.length).toBeGreaterThan(0);
    const firstCard = tables[0]!;
    const rowHeaders = within(firstCard)
      .getAllByRole('rowheader')
      .map((th) => th.textContent?.replace(/derived$/, '').trim());
    expect(rowHeaders).toEqual([...CARD_FIELD_ORDER]);
  });

  it('never leaves a card field blank', () => {
    renderLocation();
    tab('Spec sheet');
    const table = screen.getAllByRole('table')[0]!;
    for (const cell of within(table).getAllByRole('cell')) {
      expect(cell.textContent?.trim().length ?? 0).toBeGreaterThan(0);
    }
  });

  it('marks the three inferred fields as derived on screen', () => {
    renderLocation();
    tab('Spec sheet');
    const table = screen.getAllByRole('table')[0]!;
    expect(within(table).getAllByText('derived')).toHaveLength(3);
  });

  it('shows the unverified badge against the non-standard "monitor" level', () => {
    renderLocation();
    tab('Purpose');
    fireEvent.change(screen.getByLabelText(/What must be possible at that distance/), {
      target: { value: 'monitor' },
    });
    expect(screen.getAllByTitle(/NOT one of the four IEC 62676-4 levels/).length).toBeGreaterThan(0);
  });

  it('recomputes live: tightening the purpose changes the achieved-density verdict', () => {
    renderLocation();
    // Default is recognise over 6 m at 10 m — comfortable.
    expect(screen.getAllByText(/px\/m ·\s*(Pass|Marginal)/).length).toBeGreaterThan(0);

    // Now ask to identify across 30 m of scene at 60 m, which nothing can do.
    setNumber(/Distance to the furthest point of interest/, '60');
    setNumber(/Required scene width at that distance/, '30');
    tab('Purpose');
    fireEvent.change(screen.getByLabelText(/What must be possible at that distance/), {
      target: { value: 'identify' },
    });

    expect(screen.getByText('No model satisfies these constraints')).toBeTruthy();
    expect(screen.getByText('What to change')).toBeTruthy();
    expect(screen.getByText('Nearest misses')).toBeTruthy();
  });

  it('reports an invalid input inline rather than crashing', () => {
    renderLocation();
    setNumber(/Mounting height/, '0');
    expect(screen.getByText(/Mounting height must be a positive number/)).toBeTruthy();
    expect(screen.getByText('Check the inputs')).toBeTruthy();
  });

  it('switches to room dimensions and derives the scene width', () => {
    renderLocation();
    fireEvent.change(screen.getByLabelText(/Specify the coverage as/), {
      target: { value: 'room' },
    });
    expect(screen.getByLabelText(/Room length/)).toBeTruthy();
    expect(screen.getByLabelText(/Room width/)).toBeTruthy();
    expect(screen.getByLabelText(/Overlap allowance/)).toBeTruthy();
  });

  it('switches units without changing the scenario', () => {
    renderLocation();
    const metricDistance = screen.getByLabelText(/Distance to the furthest point of interest/, {
      selector: 'input',
    }) as HTMLInputElement;
    expect(metricDistance.value).toBe('10');

    fireEvent.click(screen.getByRole('button', { name: 'Imperial' }));
    const imperial = screen.getByLabelText(/Distance to the furthest point of interest/, {
      selector: 'input',
    }) as HTMLInputElement;
    // 10 m is 32.81 ft.
    expect(Number(imperial.value)).toBeCloseTo(32.81, 1);
  });

  it('applies a required capability as a hard filter and says what it filtered on', () => {
    renderLocation();
    tab('Client requirements');
    fireEvent.click(screen.getByRole('checkbox', { name: /ANPR \/ licence-plate recognition/ }));
    tab(/^Excluded/);
    expect(screen.getByText(/Hard-filtered on: ANPR/)).toBeTruthy();
  });

  it('adds and removes locations, keeping at least one', () => {
    renderLocation();
    const items = () => within(screen.getByRole('list', { name: 'Locations' })).getAllByRole('listitem');
    expect(items()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Add location' }));
    expect(items()).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /Remove Location 2/ }));
    expect(items()).toHaveLength(1);
    // The last one cannot be removed.
    expect(
      (screen.getByRole('button', { name: /Remove Main gate/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('shows project totals including the PoE switch budget', () => {
    render(<App />);
    expect(screen.getByText('PoE load')).toBeTruthy();
    expect(screen.getByText('Aggregate bitrate')).toBeTruthy();
    expect(screen.getByText(/budget .* W at the switch/)).toBeTruthy();
  });

  it('writes the scenario into the URL hash', () => {
    render(<App />);
    expect(window.location.hash.length).toBeGreaterThan(20);
    const decoded = decodeProject(window.location.hash.slice(1));
    expect(decoded.ok).toBe(true);
  });

  it('every "how this was calculated" disclosure is reachable', () => {
    renderLocation();
    tab('Calculation');
    const explains = screen.getAllByText('How this was calculated');
    expect(explains.length).toBeGreaterThan(5);
    fireEvent.click(explains[0]!);
    // The formula text lives inside the same details element.
    const details = explains[0]!.closest('details');
    expect(details?.textContent?.length ?? 0).toBeGreaterThan(40);
  });

  it('renders the geometry sketch with an accessible description', () => {
    renderLocation();
    tab('Sketch');
    expect(screen.getByLabelText(/Side elevation: camera at/)).toBeTruthy();
    expect(screen.getByLabelText(/Plan view:/)).toBeTruthy();
  });

  it('exposes the exclusion list with a reason per model', () => {
    renderLocation();
    tab(/^Excluded/);
    const items = within(screen.getByRole('list', { name: 'Excluded models' })).getAllByRole('listitem');
    expect(items.length).toBeGreaterThan(0);
    for (const li of items) {
      // model name, then a non-empty reason
      expect(li.children).toHaveLength(2);
      expect(li.children[1]!.textContent!.trim().length).toBeGreaterThan(10);
    }
  });
});

describe('shareable URL state', () => {
  it('round-trips a multi-location project', () => {
    const project = {
      ...defaultProject(),
      locations: [defaultLocation('loc-1', 'Gate'), defaultLocation('loc-2', 'Lobby')],
    };
    const encoded = encodeProject(project, 'imperial');
    const decoded = decodeProject(encoded);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.state.units).toBe('imperial');
    expect(decoded.state.project.locations.map((l) => l.name)).toEqual(['Gate', 'Lobby']);
  });

  it('round-trips an edited scenario exactly', () => {
    const edited = {
      ...defaultProject(),
      locations: [
        {
          ...defaultLocation('loc-1', 'Weighbridge'),
          purpose: 'lpr' as const,
          geometry: { ...DEFAULT_GEOMETRY, targetDistanceMetres: 7.5, sceneWidthMetres: 2.6 },
        },
      ],
    };
    const decoded = decodeProject(encodeProject(edited, 'metric'));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.state.project.locations[0]!.purpose).toBe('lpr');
    expect(decoded.state.project.locations[0]!.geometry.sceneWidthMetres).toBe(2.6);
  });

  it('falls back to defaults with a readable warning on a truncated link', () => {
    const encoded = encodeProject(defaultProject(), 'metric');
    const { state, warning } = readStateFromHash(`#${encoded.slice(0, 30)}`);
    expect(warning).toMatch(/Starting from defaults instead/);
    expect(state.project.locations).toHaveLength(1);
  });

  it('rejects a link whose numbers are outside any sane range', () => {
    const bad = encodeProject(
      {
        ...defaultProject(),
        locations: [
          {
            ...defaultLocation('loc-1', 'Silly'),
            geometry: { ...DEFAULT_GEOMETRY, targetDistanceMetres: 1e9 },
          },
        ],
      },
      'metric',
    );
    const decoded = decodeProject(bad);
    expect(decoded.ok).toBe(false);
    if (decoded.ok) return;
    expect(decoded.reason).toMatch(/targetDistanceMetres/);
  });

  it('repairs an activeLocationId that points at nothing', () => {
    const payload = {
      v: 1,
      name: 'P',
      units: 'metric',
      locations: [defaultLocation('loc-1', 'Only')],
      activeLocationId: 'does-not-exist',
    };
    const encoded = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const decoded = decodeProject(encoded);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.state.project.activeLocationId).toBe('loc-1');
  });

  it('returns a reason rather than throwing on junk', () => {
    expect(decodeProject('!!!!not base64!!!!').ok).toBe(false);
    expect(decodeProject(btoa('not json')).ok).toBe(false);
    expect(decodeProject('').ok).toBe(false);
  });
});

describe('ContracTech header branding', () => {
  const root = resolve(__dirname, '..', '..');

  it('shows the logo in the header, light and dark variants, with the company name as alt text', () => {
    const { container } = render(<App />);
    // The app shell's own header is the first <header>; cards have their own.
    const header = container.querySelector('header')!;
    const logos = within(header).getAllByAltText(COMPANY_NAME) as HTMLImageElement[];
    expect(logos).toHaveLength(2);
    expect(logos.map((img) => img.className.match(/brand-logo-(light|dark)/)?.[1]).sort()).toEqual([
      'dark',
      'light',
    ]);
    expect(logos.map((img) => img.getAttribute('src'))).toEqual([LOGO_LIGHT_URL, LOGO_DARK_URL]);
    // h-8 = 32 px tall, inside the brief's 28 to 36 px band; width follows aspect.
    for (const img of logos) expect(img.className).toMatch(/\bh-8\b.*\bw-auto\b/);
    // The logo sits before the page heading, i.e. on the left of the header row.
    const heading = within(header).getByRole('heading', { level: 1 });
    expect(logos[0]!.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('switches variant with the theme through CSS, covering explicit and OS dark mode', () => {
    const css = readFileSync(join(root, 'src', 'index.css'), 'utf8');
    expect(css).toMatch(/\.brand-logo-dark\s*\{\s*display:\s*none;/);
    expect(css).toMatch(/:root\[data-theme='dark'\] \.brand-logo-light\s*\{\s*display:\s*none;/);
    expect(css).toMatch(/:root\[data-theme='dark'\] \.brand-logo-dark\s*\{\s*display:\s*block;/);
    expect(css).toMatch(/prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme='light'\]\) \.brand-logo-light/);
  });

  it('applies the theme choice to the document so those rules fire', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Theme'), { target: { value: 'dark' } });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    fireEvent.change(screen.getByLabelText('Theme'), { target: { value: 'system' } });
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('titles the page "ContracTech — CCTV Design"', () => {
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    expect(APP_TITLE).toBe('ContracTech — CCTV Design');
    expect(html).toContain(`<title>${APP_TITLE}</title>`);
  });

  it('never uses the company stamp in the UI', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const p = join(dir, entry);
        if (statSync(p).isDirectory()) { walk(p); continue; }
        if (!/\.(tsx?|css|html)$/.test(entry) || /\.test\.tsx?$/.test(entry) || entry === 'brand.ts') continue;
        if (/STAMP_URL|contractech-stamp|company-stamp/.test(readFileSync(p, 'utf8'))) offenders.push(p);
      }
    };
    walk(join(root, 'src'));
    expect(offenders).toEqual([]);
  });
});

describe('shareable URL state — phase 2', () => {
  const toB64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  it('round-trips the project-wide design settings', () => {
    const p = defaultProject();
    const edited = {
      ...p,
      settings: {
        ...p.settings,
        storage: { ...p.settings.storage, raidLevel: '5' as const, hotSpare: true },
        cabling: { ...p.settings.cabling, wastePercent: 15 },
      },
    };
    const decoded = decodeProject(encodeProject(edited, 'metric'));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.state.project.settings.storage.raidLevel).toBe('5');
    expect(decoded.state.project.settings.cabling.wastePercent).toBe(15);
  });

  it('still opens a phase-1 link (no settings block), filling the defaults', () => {
    const phase1 = { v: 1, name: 'Old', units: 'metric', locations: [defaultLocation('loc-1', 'Gate')], activeLocationId: 'loc-1' };
    const decoded = decodeProject(toB64(phase1));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.state.project.settings).toEqual(defaultProject().settings);
  });

  it('never puts the site plan in the link', () => {
    const p = defaultProject();
    const withPlan = {
      ...p,
      sitePlan: { ...p.sitePlan, devices: [{ kind: 'nvr' as const, id: 'nvr-1', label: 'Rack', x: 1, y: 2 }] },
    };
    const encoded = encodeProject(withPlan, 'metric');
    expect(encoded).toBe(encodeProject(p, 'metric'));
    const decoded = decodeProject(encoded);
    expect(decoded.ok && decoded.state.project.sitePlan.devices.length).toBe(0);
  });

  // Regression: phase 1 validated requiredCapabilities as any string and cast it.
  it('rejects a link carrying an unknown camera capability', () => {
    const loc = defaultLocation('loc-1', 'Gate');
    const bad = {
      v: 1, name: 'P', units: 'metric', activeLocationId: 'loc-1',
      locations: [{ ...loc, requirements: { ...loc.requirements, requiredCapabilities: ['x-ray-vision'] } }],
    };
    const decoded = decodeProject(toB64(bad));
    expect(decoded.ok).toBe(false);
    if (decoded.ok) return;
    expect(decoded.reason).toMatch(/requiredCapabilities/);
  });
});
