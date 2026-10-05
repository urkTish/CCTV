/**
 * Admin — the engineer's tool. One project, the workflow as sections, each with
 * a status; results recompute live from state on every change.
 *
 * State lives here and the project (every location and design setting) is
 * mirrored into `location.hash`, so a scenario is shareable and reproducible.
 * The project's extras (client, prices, report state, intake marks) travel in
 * the project file and the autosave, not in the link.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { intakeToProject, recorderAnswersInWords } from '../../client/intakeMapping.ts';
import { INTAKE_FILE_FORMAT, parseIntakeFile, parseIntakeLink, type Intake } from '../../client/intakeFile.ts';
import { PURPOSES } from '../../domain/dori.ts';
import { replaceImage } from '../../domain/sitePlanEdit.ts';
import { buildBillOfMaterials } from '../../engine/billOfMaterials.ts';
import { designProject, inheritedProjectAnalytics, recommendAll, SHIPPED_CATALOGUE } from '../../engine/projectDesign.ts';
import { siteMapView } from '../../engine/siteMapView.ts';
import { loadProfile, type EngineerProfile } from '../../state/engineerProfile.ts';
import { changedLocationFields } from '../../state/locationFields.ts';
import {
  activeLocation,
  defaultLocation,
  defaultProject,
  nextLocationId,
  projectTotals,
  pruneSitePlan,
  replaceLocation,
  type Location,
  type Project,
  type UnitSystemState,
} from '../../state/projectTypes.ts';
import { encodeProject, readStateFromHash } from '../../state/urlState.ts';
import {
  assumedCounts,
  confirmAssumed,
  DEFAULT_EXTRAS,
  formatOf,
  parseWorkspace,
  pruneExtras,
  type ProjectExtras,
} from '../../state/workspace.ts';
import { CableResults, DesignErrors, RecorderResults, StorageResults, SwitchResults } from '../DesignPanel.tsx';
import { CablingSettings, RecordingSettings, SwitchSettings } from '../DesignSettingsPanel.tsx';
import { Button, Notice } from '../primitives.tsx';
import { ProjectFileBar, type OpenOutcome } from '../ProjectFileBar.tsx';
import { SiteMapPanel } from '../SiteMapPanel.tsx';
import { useAutosave } from '../useAutosave.ts';
import { AdminHeader, AdminNav, SectionFrame, type Theme } from './AdminChrome.tsx';
import { BomSection } from './BomSection.tsx';
import { JumpPalette, type JumpTarget } from './JumpPalette.tsx';
import { LocationDetail, LocationList } from './LocationsSection.tsx';
import { OverviewSection } from './OverviewSection.tsx';
import { collectWarnings, SECTIONS, sectionDef, sectionStatuses, type SectionId } from './sections.ts';
import { ReportSection } from './ReportSection.tsx';
import { SettingsSection } from './SettingsSection.tsx';

const NAV_PREF_KEY = 'contractech-cctv.nav-collapsed';

function readNavPref(): boolean {
  try {
    return globalThis.localStorage?.getItem(NAV_PREF_KEY) === '1';
  } catch {
    return false;
  }
}

function writeNavPref(collapsed: boolean): void {
  try {
    globalThis.localStorage?.setItem(NAV_PREF_KEY, collapsed ? '1' : '0');
  } catch {
    // A convenience only: a blocked localStorage just means the choice is not remembered.
  }
}

/** A client's intake as a draft project, with every assumed value recorded. */
function draftFromIntake(intake: Intake): { project: Project; extras: ProjectExtras; assumedTotal: number } {
  const mapped = intakeToProject(intake.answers);
  const project = intake.planImage ? { ...mapped.project, sitePlan: replaceImage(mapped.project.sitePlan, intake.planImage) } : mapped.project;
  const site = intake.answers.site;
  const extras: ProjectExtras = {
    ...DEFAULT_EXTRAS,
    clientName: site.contactName.trim(),
    clientContact: [site.contactPhone.trim(), site.contactEmail.trim()].filter(Boolean).join(' · '),
    intake: { submittedOn: intake.submittedOn, answers: intake.answers, assumed: mapped.assumed, clientWords: mapped.clientWords },
  };
  const assumedTotal = Object.values(mapped.assumed).reduce((n, f) => n + Object.keys(f).length, 0);
  return { project, extras, assumedTotal };
}

export function AdminApp({ intakePayload = null }: { intakePayload?: string | null }) {
  const initial = useMemo(() => {
    if (intakePayload !== null) {
      const r = parseIntakeLink(intakePayload);
      if (r.ok) {
        const d = draftFromIntake(r.intake);
        return {
          project: d.project,
          units: 'metric' as UnitSystemState,
          extras: d.extras,
          notice: `Opened the client intake “${d.project.name}” as a draft project. ${d.assumedTotal} values were assumed from the client's answers; each is marked “assumed from client intake — please confirm” on its input.`,
          warning: null,
        };
      }
      return { project: defaultProject(), units: 'metric' as UnitSystemState, extras: DEFAULT_EXTRAS, notice: null, warning: `${r.reason} Starting from a new project instead.` };
    }
    const fromHash = readStateFromHash(window.location.hash);
    return { project: fromHash.state.project, units: fromHash.state.units, extras: DEFAULT_EXTRAS, notice: null, warning: fromHash.warning };
  }, [intakePayload]);

  const [project, setProject] = useState<Project>(initial.project);
  const [units, setUnits] = useState<UnitSystemState>(initial.units);
  const [extras, setExtras] = useState<ProjectExtras>(initial.extras);
  const [theme, setTheme] = useState<Theme>('system');
  const [section, setSection] = useState<SectionId>('overview');
  const [navCollapsed, setNavCollapsed] = useState<boolean>(readNavPref);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [locationView, setLocationView] = useState<'list' | 'detail'>('list');
  const [banner, setBanner] = useState<{ kind: 'warning' | 'info'; text: string } | null>(
    initial.warning ? { kind: 'warning', text: initial.warning } : initial.notice ? { kind: 'info', text: initial.notice } : null,
  );
  const [copied, setCopied] = useState(false);
  const [profile, setProfile] = useState<EngineerProfile>(() => loadProfile());
  const [mapSelect, setMapSelect] = useState<{ id: string; seq: number } | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const focusOnNavigate = useRef(false);

  // Mirror the project into the hash. `replaceState` so Back is not filled with every keystroke.
  useEffect(() => {
    window.history.replaceState(null, '', `#${encodeProject(project, units)}`);
  }, [project, units]);

  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!focusOnNavigate.current) return;
    focusOnNavigate.current = false;
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo?.({ top: 0 });
  }, [section]);

  // --- derived, all from the engine -------------------------------------------
  const location = activeLocation(project);
  const locations = project.locations;
  const results = useMemo(() => recommendAll({ locations }), [locations]);
  const result = results.get(location.id)!;
  const design = useMemo(() => designProject(project, SHIPPED_CATALOGUE, results), [project, results]);
  const bom = useMemo(() => buildBillOfMaterials(project), [project]);
  const totals = useMemo(() => projectTotals(project), [project]);
  const mapView = useMemo(() => siteMapView(project, results), [project, results]);
  const inheritedAnalytics = useMemo(
    () => inheritedProjectAnalytics({ locations }, new Set(design.instances.map((i) => i.locationId))),
    [locations, design.instances],
  );
  const assumedByLocation = useMemo(() => assumedCounts(extras), [extras]);
  const statusInputs = { project, results, design, mapView, bom, reportFinal: extras.report.status === 'final', assumedByLocation };
  const warnings = useMemo(() => collectWarnings(statusInputs), [project, results, design, mapView, bom, extras]); // eslint-disable-line react-hooks/exhaustive-deps
  const statuses = useMemo(() => sectionStatuses(statusInputs, warnings), [warnings]); // eslint-disable-line react-hooks/exhaustive-deps
  const autosave = useAutosave(project, units, extras);

  const navSections = SECTIONS;

  // --- actions ------------------------------------------------------------------
  const navigate = useCallback((id: SectionId) => {
    focusOnNavigate.current = true;
    setSection(id);
    setDrawerOpen(false);
    if (id === 'locations') setLocationView('list');
  }, []);

  const openLocation = useCallback((id: string) => {
    focusOnNavigate.current = true;
    setProject((p) => ({ ...p, activeLocationId: id }));
    setSection('locations');
    setLocationView('detail');
    setDrawerOpen(false);
  }, []);

  const updateLocation = (updated: Location) => {
    const changed = changedLocationFields(location, updated);
    setProject((p) => pruneSitePlan(replaceLocation(p, updated)));
    if (changed.length) setExtras((e) => confirmAssumed(e, updated.id, changed));
  };

  const addLocation = () => {
    setProject((p) => {
      const id = nextLocationId(p);
      return { ...p, locations: [...p.locations, defaultLocation(id, `Location ${p.locations.length + 1}`)], activeLocationId: id };
    });
    setLocationView('detail');
  };

  const removeLocation = (id: string) => {
    setProject((p) => {
      if (p.locations.length <= 1) return p; // a project always has at least one
      const remaining = p.locations.filter((l) => l.id !== id);
      const first = remaining[0];
      if (!first) return p;
      return pruneSitePlan({ ...p, locations: remaining, activeLocationId: p.activeLocationId === id ? first.id : p.activeLocationId });
    });
    setExtras((e) => pruneExtras(e, project.locations.filter((l) => l.id !== id).map((l) => l.id)));
  };

  const stepLocation = (delta: -1 | 1) => {
    const i = locations.findIndex((l) => l.id === location.id);
    const next = locations[i + delta];
    if (next) setProject((p) => ({ ...p, activeLocationId: next.id }));
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Clipboard access can be refused (insecure context, permissions). Say so
      // rather than swallowing it; the address bar still holds the link.
      setBanner({
        kind: 'warning',
        text: `Could not copy to the clipboard (${err instanceof Error ? err.message : 'unknown error'}). The link is in the address bar.`,
      });
    }
  };

  const openText = (text: string, fileName: string): OpenOutcome => {
    if (formatOf(text) === INTAKE_FILE_FORMAT) {
      const r = parseIntakeFile(text);
      if (!r.ok) return { ok: false, message: `${fileName} was not opened. ${r.reason}` };
      const d = draftFromIntake(r.intake);
      setProject(d.project);
      setUnits('metric');
      setExtras(d.extras);
      return {
        ok: true,
        message: `Opened ${fileName}: the client intake “${d.project.name}” is now a draft project. ${d.assumedTotal} values were assumed from the client's answers and are marked for you to confirm.`,
      };
    }
    const r = parseWorkspace(text);
    if (!r.ok) return { ok: false, message: `${fileName} was not opened. ${r.reason}` };
    setProject(r.opened.project);
    setUnits(r.opened.units);
    setExtras(r.extras);
    return { ok: true, message: [`Opened ${fileName}.`, ...r.notices].join(' ') };
  };

  const jump = (t: JumpTarget) => {
    if (t.kind === 'section') navigate(t.id);
    else if (t.kind === 'location') openLocation(t.id);
    else {
      navigate('map');
      setMapSelect((s) => ({ id: t.id, seq: (s?.seq ?? 0) + 1 }));
    }
  };

  // --- section content ----------------------------------------------------------
  const order = navSections.map((s) => s.id);
  const pos = order.indexOf(section);
  const prev = pos > 0 ? sectionDef(order[pos - 1]!) : null;
  const next = pos >= 0 && pos < order.length - 1 ? sectionDef(order[pos + 1]!) : null;
  const assumedHere = extras.intake?.assumed[location.id];
  const intake = extras.intake;
  const toConfirmTotal = [...assumedByLocation.values()].reduce((a, b) => a + b, 0);

  const intakeNotice = intake ? (
    <Notice
      kind={toConfirmTotal > 0 ? 'warning' : 'success'}
      title={toConfirmTotal > 0 ? `Draft from a client intake — ${toConfirmTotal} assumed value${toConfirmTotal === 1 ? '' : 's'} to confirm` : 'Draft from a client intake — every assumed value confirmed'}
      actions={
        toConfirmTotal > 0 ? (
          <Button size="sm" onClick={() => openLocation([...assumedByLocation.keys()][0] ?? location.id)}>
            Review the first location
          </Button>
        ) : undefined
      }
    >
      <p>
        {intake.answers.areas.length} area{intake.answers.areas.length === 1 ? '' : 's'} from the client
        {intake.submittedOn ? `, sent ${intake.submittedOn}` : ''}. The recommendation is preliminary until the site survey confirms
        mounting heights, distances and cable routes.
      </p>
    </Notice>
  ) : null;

  const projectFile = (
    <>
      <ProjectFileBar
        project={project}
        units={units}
        extras={extras}
        autosaveStatus={autosave.status}
        onOpenText={openText}
        onCopyLink={() => void copyLink()}
        copied={copied}
      />
      {autosave.offer && (
        <div className="mt-3">
          <Notice
            kind="info"
            role="alert"
            title={`This browser holds an autosaved project, “${autosave.offer.project.name}”, with a site map or report details.`}
            actions={
              <>
                <Button
                  variant="primary"
                  onClick={() => {
                    const o = autosave.accept();
                    if (o) {
                      setProject(o.project);
                      setUnits(o.units);
                      setExtras(o.extras);
                    }
                  }}
                >
                  Restore autosave
                </Button>
                <Button variant="ghost" onClick={autosave.dismiss}>
                  Dismiss
                </Button>
              </>
            }
          >
            Restoring it replaces the project on screen.
          </Notice>
        </div>
      )}
    </>
  );

  let content: ReactNode;
  let actions: ReactNode = null;
  switch (section) {
    case 'overview':
      content = (
        <OverviewSection
          project={project}
          extras={extras}
          totals={totals}
          design={design}
          bom={bom}
          warnings={warnings}
          onProjectName={(name) => setProject((p) => ({ ...p, name: name.trim() === '' ? p.name : name }))}
          onExtras={setExtras}
          onNavigate={navigate}
          onOpenLocation={openLocation}
          projectFile={projectFile}
          intakeNotice={intakeNotice}
        />
      );
      break;
    case 'map':
      content = (
        <SiteMapPanel
          project={project}
          units={units}
          results={results}
          onPlanChange={(sitePlan) => setProject((p) => ({ ...p, sitePlan }))}
          selectRequest={mapSelect}
        />
      );
      break;
    case 'locations': {
      const index = locations.findIndex((l) => l.id === location.id);
      actions = (
        <Button variant="primary" icon="plus" onClick={addLocation}>
          Add location
        </Button>
      );
      content = (
        <div className="grid items-start gap-4 @6xl/section:grid-cols-[14rem_minmax(0,1fr)]">
          <div className={`${locationView === 'list' ? '' : 'hidden'} min-w-0 @6xl/section:block @6xl/section:sticky @6xl/section:top-16`}>
            <LocationList
              project={project}
              results={results}
              warnings={warnings}
              assumedByLocation={assumedByLocation}
              onSelect={(id) => {
                setProject((p) => ({ ...p, activeLocationId: id }));
                setLocationView('detail');
              }}
              onRemove={removeLocation}
            />
          </div>
          <div className={`${locationView === 'detail' ? '' : 'hidden'} min-w-0 @6xl/section:block`}>
            <LocationDetail
              location={location}
              result={result}
              units={units}
              index={index}
              total={locations.length}
              onChange={updateLocation}
              onStep={stepLocation}
              onBack={() => setLocationView('list')}
              assumed={assumedHere ? new Map(Object.entries(assumedHere)) : undefined}
              onConfirm={(keys) => setExtras((e) => confirmAssumed(e, location.id, keys))}
              clientWords={intake?.clientWords[location.id]}
            />
          </div>
        </div>
      );
      break;
    }
    case 'recording':
      content = (
        <div className="grid items-start gap-4 @5xl/section:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]">
          <RecordingSettings
            settings={project.settings}
            units={units}
            inheritedAnalytics={inheritedAnalytics}
            onChange={(settings) => setProject((p) => ({ ...p, settings }))}
            clientChoice={intake ? recorderAnswersInWords(intake.answers) : null}
          />
          <div className="grid min-w-0 gap-4">
            <DesignErrors design={design} />
            <StorageResults design={design} units={units} />
            <RecorderResults design={design} units={units} />
          </div>
        </div>
      );
      break;
    case 'network':
      content = (
        <div className="grid items-start gap-4 @5xl/section:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]">
          <SwitchSettings settings={project.settings} units={units} onChange={(settings) => setProject((p) => ({ ...p, settings }))} />
          <div className="grid min-w-0 gap-4">
            <DesignErrors design={design} />
            <SwitchResults design={design} units={units} />
          </div>
        </div>
      );
      break;
    case 'cabling':
      content = (
        <div className="grid gap-4">
          <CablingSettings settings={project.settings} units={units} onChange={(settings) => setProject((p) => ({ ...p, settings }))} />
          <DesignErrors design={design} />
          <CableResults design={design} units={units} />
        </div>
      );
      break;
    case 'bom':
      content = <BomSection bom={bom} extras={extras} onExtras={setExtras} />;
      break;
    case 'report':
      content = (
        <ReportSection
          project={project}
          extras={extras}
          profile={profile}
          bom={bom}
          assumedLeft={toConfirmTotal}
          onExtras={setExtras}
          onNavigate={navigate}
        />
      );
      break;
    case 'settings':
      content = <SettingsSection profile={profile} onProfile={setProfile} />;
      break;
    default:
      content = null;
  }

  return (
    <div className="min-h-full">
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          headingRef.current?.focus();
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded-control focus:bg-[var(--color-accent)] focus:px-3 focus:py-2 focus:text-[var(--color-accent-ink)]"
      >
        Skip to content
      </a>
      <AdminHeader
        projectName={project.name}
        units={units}
        onUnits={setUnits}
        theme={theme}
        onTheme={setTheme}
        onOpenNav={() => setDrawerOpen(true)}
        onOpenPalette={() => setPaletteOpen(true)}
        navOpen={drawerOpen}
      />
      <div className="flex">
        <AdminNav
          active={section}
          statuses={statuses}
          onNavigate={navigate}
          collapsed={navCollapsed}
          onToggleCollapsed={() =>
            setNavCollapsed((c) => {
              writeNavPref(!c);
              return !c;
            })
          }
          drawerOpen={drawerOpen}
          onCloseDrawer={() => setDrawerOpen(false)}
          onOpenPalette={() => {
            setDrawerOpen(false);
            setPaletteOpen(true);
          }}
          sections={navSections}
        />
        <main id="main" className="min-w-0 flex-1 px-4 py-5 lg:px-6 print:p-0">
          {banner && (
            <div className="mb-4 print:hidden">
              <Notice
                kind={banner.kind}
                role="alert"
                actions={
                  <Button size="sm" variant="ghost" onClick={() => setBanner(null)}>
                    Dismiss
                  </Button>
                }
              >
                {banner.text}
              </Notice>
            </div>
          )}
          <SectionFrame def={sectionDef(section)} status={section === 'settings' ? null : statuses[section]} actions={actions} headingRef={headingRef} prev={section === 'settings' ? null : prev} next={section === 'settings' ? null : next} onNavigate={navigate}>
            {content}
          </SectionFrame>
          <footer className="mt-10 border-t print:hidden border-[var(--color-border)] pt-4 text-xs text-[var(--color-ink-3)]">
            <p>
              Pixel-density thresholds from IEC 62676-4:2014 as reproduced in the Axis white paper &ldquo;Pixel density based on IEC
              62676-4:2014&rdquo;. &ldquo;
              {PURPOSES.filter((p) => p.isEstimate)
                .map((p) => p.label)
                .join('” and “')}
              &rdquo; are not levels in that standard and are marked unverified wherever they appear.
            </p>
            <p className="mt-1">
              Bitrate and storage figures from Hikvision&rsquo;s published recommended bit-rate tables. Every camera specification is read
              from the manufacturer datasheet linked on its card; fields the datasheet does not state render as &ldquo;Not specified&rdquo;.
              Nothing here is a substitute for a site survey.
            </p>
          </footer>
        </main>
      </div>
      <JumpPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} project={project} mapView={mapView} onJump={jump} />
    </div>
  );
}

