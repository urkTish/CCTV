/**
 * Admin — the engineer's tool. One project, the workflow as sections, each with
 * a status; results recompute live from state on every change.
 *
 * State lives here and the project (every location and design setting) is
 * mirrored into `location.hash`, so a scenario is shareable and reproducible.
 * The project's extras (client, prices, report state, intake marks) travel in
 * the project file and the autosave, not in the link.
 */

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { todayIso } from '../../client/intakeFile.ts';
import { deriveRenovation, RN_SECTIONS, rnSectionDef, type RnSectionId } from '../../renovation/derive.ts';
import { draftFromRenovationIntake, parseRenovationIntake, parseRenovationLink, RN_INTAKE_FORMAT, type RenovationIntake } from '../../renovation/intake.ts';
import { SERVICE_LINE_LABEL, type ServiceLine } from '../../renovation/model.ts';
import { addRenovationLine, ensurePortal, loadHouseLibrary } from '../../renovation/rnState.ts';
import { LibrarySection } from '../../renovation/ui/LibrarySection.tsx';
import { RnClientSection, RnOverview } from '../../renovation/ui/OverviewSections.tsx';
import { CompletionSection, ConceptsSection } from '../../renovation/ui/PictureSections.tsx';
import { ProposalSection } from '../../renovation/ui/ProposalSection.tsx';
import { BoqSection, QuantitiesSection } from '../../renovation/ui/QuantitiesBoq.tsx';
import { RnSettingsCard } from '../../renovation/ui/RnSettingsCard.tsx';
import { SpecSection } from '../../renovation/ui/SpecSection.tsx';
import { SurveySection } from '../../renovation/ui/SurveySection.tsx';
import { VisualsSection } from '../../renovation/ui/VisualsSection.tsx';

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
import { collectWarnings, isToolSection, SECTIONS, sectionDef, sectionStatuses, SETTINGS_SECTION, type SectionDef, type SectionId, type SectionStatus } from './sections.ts';
import { ReportSection } from './ReportSection.tsx';
import { CameraFinderSection } from './CameraFinderSection.tsx';
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

type AdminSection = SectionId | RnSectionId;

/** A client's renovation intake as a draft: a renovation-only project with every assumed value recorded. */
function draftFromRenovation(intake: RenovationIntake): { project: Project; extras: ProjectExtras; assumedTotal: number } {
  const d = draftFromRenovationIntake(intake, loadHouseLibrary());
  const base = defaultProject();
  const project = { ...base, name: d.projectName || base.name, sitePlan: intake.planImage ? replaceImage(base.sitePlan, intake.planImage) : base.sitePlan };
  return { project, extras: { ...DEFAULT_EXTRAS, clientName: d.clientName, clientContact: d.clientContact, portal: d.portal }, assumedTotal: d.assumedTotal };
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

export function AdminApp({ intakePayload = null, renovationPayload = null }: { intakePayload?: string | null; renovationPayload?: string | null }) {
  const initial = useMemo(() => {
    if (renovationPayload !== null) {
      const r = parseRenovationLink(renovationPayload);
      if (r.ok) {
        const d = draftFromRenovation(r.intake);
        return {
          project: d.project,
          units: 'metric' as UnitSystemState,
          extras: d.extras,
          notice: `Opened the client's renovation intake “${d.project.name}” as a draft (from a link, so without photos — ask the client for the file to get them). ${d.assumedTotal} values were assumed and are marked for you to confirm.`,
          warning: null,
        };
      }
      return { project: defaultProject(), units: 'metric' as UnitSystemState, extras: DEFAULT_EXTRAS, notice: null, warning: `${r.reason} Starting from a new project instead.` };
    }
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
  }, [intakePayload, renovationPayload]);

  const [project, setProject] = useState<Project>(initial.project);
  const [units, setUnits] = useState<UnitSystemState>(initial.units);
  const [extras, setExtras] = useState<ProjectExtras>(initial.extras);
  const [theme, setTheme] = useState<Theme>('system');
  const [section, setSection] = useState<AdminSection>(() => (initial.extras.portal?.lines.includes('renovation') ? 'rn-overview' : 'overview'));
  const [line, setLine] = useState<ServiceLine>(() => (initial.extras.portal?.lines.includes('renovation') && !initial.extras.portal.lines.includes('cctv') ? 'renovation' : initial.extras.portal?.lines.includes('renovation') && renovationPayload !== null ? 'renovation' : 'cctv'));
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
  // The BOM and the totals each re-run the recommendation pass (their APIs take
  // only the project), so they follow a deferred copy: typing stays responsive and
  // they catch up a frame later.
  const deferredProject = useDeferredValue(project);
  const bom = useMemo(() => buildBillOfMaterials(deferredProject), [deferredProject]);
  const totals = useMemo(() => projectTotals(deferredProject), [deferredProject]);
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
  const today = todayIso();
  const portal = extras.portal;
  const rn = useMemo(() => deriveRenovation(portal, project.sitePlan, today), [portal, project.sitePlan, today]);
  const onPortal = useCallback((fn: (p: NonNullable<ProjectExtras['portal']>) => NonNullable<ProjectExtras['portal']>) => setExtras((e) => ({ ...e, portal: fn(ensurePortal(e.portal)) })), []);
  const lines: readonly ServiceLine[] = portal?.lines ?? ['cctv'];
  const onRenovation = line === 'renovation' && !!portal?.renovation;

  const navSections: readonly SectionDef<AdminSection>[] = onRenovation ? RN_SECTIONS : SECTIONS;
  const navStatuses: Readonly<Partial<Record<AdminSection, SectionStatus>>> = onRenovation ? rn.statuses : statuses;

  // --- actions ------------------------------------------------------------------
  const navigate = useCallback((id: AdminSection) => {
    focusOnNavigate.current = true;
    // A section belongs to one line (the Site map and Settings are shared): follow it, e.g. from Ctrl K.
    if (id.startsWith('rn-')) setLine('renovation');
    else if (id !== 'map' && id !== 'settings') setLine('cctv');
    setSection(id);
    setDrawerOpen(false);
    if (id === 'locations') setLocationView('list');
  }, []);

  const switchLine = (next: ServiceLine) => {
    if (next === 'renovation' && !extras.portal?.renovation) setExtras((e) => ({ ...e, portal: addRenovationLine(e.portal, loadHouseLibrary()) }));
    if (next === 'cctv' && extras.portal && !extras.portal.lines.includes('cctv')) setExtras((e) => (e.portal ? { ...e, portal: { ...e.portal, lines: ['cctv', ...e.portal.lines] } } : e));
    setLine(next);
    focusOnNavigate.current = true;
    setSection(next === 'renovation' ? 'rn-overview' : 'overview');
    setDrawerOpen(false);
  };

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
    if (formatOf(text) === RN_INTAKE_FORMAT) {
      const r = parseRenovationIntake(text);
      if (!r.ok) return { ok: false, message: `${fileName} was not opened. ${r.reason}` };
      const d = draftFromRenovation(r.intake);
      setProject(d.project);
      setUnits('metric');
      setExtras(d.extras);
      setLine('renovation');
      setSection('rn-overview');
      const message = `Opened ${fileName}: the client's renovation intake “${d.project.name}” is now a draft with ${r.intake.photos.length} photo(s). ${d.assumedTotal} values were assumed from the client's answers and are marked “assumed from client intake — please confirm”.`;
      // The section changes, so the file bar that would show the message is replaced: say it in the banner.
      setBanner({ kind: 'info', text: message });
      return { ok: true, message };
    }
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
    const rnOnly = r.extras.portal?.lines.includes('renovation') && !r.extras.portal.lines.includes('cctv');
    const message = [`Opened ${fileName}.`, ...r.notices, r.extras.portal?.renovation && !rnOnly ? 'It includes a renovation line — switch to it with the service-line switcher.' : ''].filter(Boolean).join(' ');
    if (line !== (rnOnly ? 'renovation' : 'cctv') || section !== (rnOnly ? 'rn-overview' : 'overview')) setBanner({ kind: 'info', text: message });
    setLine(rnOnly ? 'renovation' : 'cctv');
    setSection(rnOnly ? 'rn-overview' : 'overview');
    return { ok: true, message };
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
  const prev = pos > 0 ? navSections[pos - 1]! : null;
  const next = pos >= 0 && pos < order.length - 1 ? navSections[pos + 1]! : null;
  // Settings and the camera finder are tools outside either line's workflow: no status, no previous / next.
  const isTool = !section.startsWith('rn-') && isToolSection(section as SectionId);
  const currentDef: SectionDef<AdminSection | 'settings'> =
    section === 'settings' ? SETTINGS_SECTION : isTool ? sectionDef(section as SectionId) : onRenovation || section.startsWith('rn-') ? rnSectionDef(section as RnSectionId) : sectionDef(section as SectionId);
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
          onProjectName={(name) => setProject((p) => ({ ...p, name }))}
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
    case 'finder':
      content = <CameraFinderSection />;
      break;
    case 'settings':
      content = (
        <SettingsSection profile={profile} onProfile={setProfile}>
          {portal?.renovation && <RnSettingsCard portal={portal} onPortal={onPortal} />}
        </SettingsSection>
      );
      break;
    case 'rn-overview':
      if (portal?.renovation)
        content = (
          <RnOverview
            portal={portal}
            onPortal={onPortal}
            derived={rn}
            onNavigate={navigate}
            extras={extras}
            onExtras={setExtras}
            projectName={project.name}
            onProjectName={(name) => setProject((p) => ({ ...p, name }))}
            projectFile={projectFile}
          />
        );
      break;
    case 'rn-client':
      if (portal?.renovation)
        content = (
          <RnClientSection
            portal={portal}
            onPortal={onPortal}
            derived={rn}
            onNavigate={navigate}
            extras={extras}
            onExtras={setExtras}
            onRemoveLine={() => {
              setLine('cctv');
              setSection('overview');
            }}
          />
        );
      break;
    case 'rn-survey':
      if (portal?.renovation) content = <SurveySection portal={portal} onPortal={onPortal} derived={rn} onNavigate={navigate} plan={project.sitePlan} />;
      break;
    case 'rn-spec':
      if (portal?.renovation) content = <SpecSection portal={portal} onPortal={onPortal} derived={rn} onNavigate={navigate} />;
      break;
    case 'rn-library':
      if (portal?.renovation) content = <LibrarySection portal={portal} onPortal={onPortal} derived={rn} onNavigate={navigate} />;
      break;
    case 'rn-quantities':
      if (portal?.renovation) content = <QuantitiesSection portal={portal} onPortal={onPortal} derived={rn} onNavigate={navigate} />;
      break;
    case 'rn-boq':
      if (portal?.renovation) content = <BoqSection portal={portal} onPortal={onPortal} derived={rn} onNavigate={navigate} />;
      break;
    case 'rn-visuals':
      if (portal?.renovation) content = <VisualsSection portal={portal} onPortal={onPortal} derived={rn} onNavigate={navigate} projectName={project.name} engineerName={profile.name} />;
      break;
    case 'rn-concepts':
      if (portal?.renovation) content = <ConceptsSection portal={portal} onPortal={onPortal} derived={rn} onNavigate={navigate} />;
      break;
    case 'rn-completion':
      if (portal?.renovation)
        content = (
          <CompletionSection
            portal={portal}
            onPortal={onPortal}
            derived={rn}
            onNavigate={navigate}
            projectName={project.name}
            clientName={extras.clientName}
            clientContact={extras.clientContact}
            profile={profile}
          />
        );
      break;
    case 'rn-proposal':
      if (portal?.renovation)
        content = (
          <ProposalSection
            portal={portal}
            onPortal={onPortal}
            derived={rn}
            onNavigate={navigate}
            projectName={project.name}
            clientName={extras.clientName}
            clientContact={extras.clientContact}
            profile={profile}
          />
        );
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
        title={onRenovation ? 'Renovation' : 'CCTV Design'}
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
          statuses={navStatuses}
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
          lineSwitcher={
            <div role="group" aria-label="Service line" className={`border-b border-[var(--color-border)] p-2 ${navCollapsed ? 'lg:px-1' : ''}`}>
              <p className={`mb-1 px-1 text-2xs font-semibold tracking-wide text-[var(--color-ink-3)] uppercase ${navCollapsed ? 'lg:sr-only' : ''}`}>Service line</p>
              <div className={`grid gap-1 ${navCollapsed ? 'lg:grid-cols-1' : 'grid-cols-2'}`}>
                {(['cctv', 'renovation'] as const).map((l) => {
                  const present = lines.includes(l) && (l === 'cctv' || !!portal?.renovation);
                  const activeLine = (l === 'renovation') === onRenovation;
                  return (
                    <button
                      key={l}
                      type="button"
                      aria-pressed={activeLine}
                      onClick={() => switchLine(l)}
                      title={present ? `${SERVICE_LINE_LABEL[l]} line` : `Add a ${l === 'cctv' ? 'CCTV' : 'renovation'} line to this project`}
                      className={`flex min-h-9 items-center justify-center gap-1 rounded-control px-2 text-xs font-semibold transition-colors ${
                        activeLine
                          ? 'bg-[var(--color-accent)] text-[var(--color-accent-ink)]'
                          : present
                            ? 'border border-[var(--color-border-strong)] text-[var(--color-ink-2)] hover:bg-[var(--color-surface-2)]'
                            : 'border border-dashed border-[var(--color-border-strong)] text-[var(--color-ink-3)] hover:bg-[var(--color-surface-2)]'
                      }`}
                    >
                      {!present && <span aria-hidden="true">+</span>}
                      <span className={navCollapsed ? 'lg:sr-only' : ''}>{present ? SERVICE_LINE_LABEL[l] : `Add ${l === 'cctv' ? 'CCTV' : 'renovation'}`}</span>
                      {navCollapsed && (
                        <span className="hidden lg:inline" aria-hidden="true">
                          {l === 'cctv' ? 'CC' : 'RN'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          }
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
          <SectionFrame def={currentDef} status={isTool ? null : (navStatuses[section] ?? null)} actions={actions} headingRef={headingRef} prev={isTool ? null : prev} next={isTool ? null : next} onNavigate={navigate}>
            {content}
          </SectionFrame>
          {onRenovation ? (
            <footer className="mt-10 border-t print:hidden border-[var(--color-border)] pt-4 text-xs text-[var(--color-ink-3)]">
              <p>
                Renovation quantities follow the formulas of the renovation specification (section 6), each shown with its trace; rules of thumb are marked
                Unverified. Prices come only from the library’s rates, never from the AI. Visuals are illustrative and labelled so. Nothing here replaces a site
                survey or a licensed engineer’s design.
              </p>
            </footer>
          ) : (
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
          )}
        </main>
      </div>
      <JumpPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} project={project} mapView={mapView} onJump={jump} />
    </div>
  );
}

