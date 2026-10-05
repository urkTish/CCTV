/**
 * The Admin shell: header (logo, title, project, jump, units, theme), the
 * workflow navigation with a status per section, and the frame every section
 * renders in (heading, status, description, previous / next).
 *
 * One navigation element serves every width: a static column (collapsible to an
 * icon rail) from 1024 px, an off-canvas drawer below that. When the drawer is
 * closed it is `invisible`, so it leaves the tab order.
 */

import { useEffect, useRef, type ReactNode, type RefObject } from 'react';

import { COMPANY_NAME, LOGO_DARK_URL, LOGO_INTRINSIC, LOGO_LIGHT_URL } from '../../brand.ts';
import type { UnitSystemState } from '../../state/projectTypes.ts';
import { Icon } from '../icons.tsx';
import { StatusBadge } from '../primitives.tsx';
import { STATUS_STYLE } from '../uiStyles.ts';
import { SETTINGS_SECTION, type SectionDef, type SectionId, type SectionStatus } from './sections.ts';

export type Theme = 'system' | 'light' | 'dark';

export function Logo() {
  // Two variants; CSS shows the one matching the active theme (`.brand-logo-*`
  // in index.css). The hidden one is display:none, so it is announced once.
  return (
    <>
      <img src={LOGO_LIGHT_URL} alt={COMPANY_NAME} width={LOGO_INTRINSIC.width} height={LOGO_INTRINSIC.height} className="brand-logo-light h-8 w-auto shrink-0" />
      <img src={LOGO_DARK_URL} alt={COMPANY_NAME} width={LOGO_INTRINSIC.width} height={LOGO_INTRINSIC.height} className="brand-logo-dark h-8 w-auto shrink-0" />
    </>
  );
}

export function ThemeSelect({ theme, onChange }: { theme: Theme; onChange: (t: Theme) => void }) {
  return (
    <>
      <label className="sr-only" htmlFor="theme-select">
        Theme
      </label>
      <select
        id="theme-select"
        value={theme}
        onChange={(e) => onChange(e.currentTarget.value as Theme)}
        className="rounded-control border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-1.5 py-1.5 text-sm text-[var(--color-ink)]"
        title="Colour theme"
      >
        <option value="system">Auto</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </>
  );
}

export function UnitsToggle({ units, onChange }: { units: UnitSystemState; onChange: (u: UnitSystemState) => void }) {
  return (
    <div className="flex overflow-hidden rounded-control border border-[var(--color-border-strong)]" role="group" aria-label="Units">
      {(['metric', 'imperial'] as const).map((sys) => (
        <button
          key={sys}
          type="button"
          onClick={() => onChange(sys)}
          aria-pressed={units === sys}
          aria-label={sys === 'metric' ? 'Metric' : 'Imperial'}
          className={`px-2.5 py-1.5 text-sm ${units === sys ? 'bg-[var(--color-accent)] font-medium text-[var(--color-accent-ink)]' : 'bg-[var(--color-surface)] text-[var(--color-ink-2)] hover:bg-[var(--color-surface-2)]'}`}
        >
          <span className="hidden sm:inline">{sys === 'metric' ? 'Metric' : 'Imperial'}</span>
          <span className="sm:hidden" aria-hidden="true">
            {sys === 'metric' ? 'm' : 'ft'}
          </span>
        </button>
      ))}
    </div>
  );
}

export function AdminHeader({
  projectName,
  units,
  onUnits,
  theme,
  onTheme,
  onOpenNav,
  onOpenPalette,
  navOpen,
}: {
  projectName: string;
  units: UnitSystemState;
  onUnits: (u: UnitSystemState) => void;
  theme: Theme;
  onTheme: (t: Theme) => void;
  onOpenNav: () => void;
  onOpenPalette: () => void;
  navOpen: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4">
        <button
          type="button"
          onClick={onOpenNav}
          className="rounded-control p-1.5 text-[var(--color-ink-2)] hover:bg-[var(--color-surface-2)] lg:hidden"
          aria-label="Open navigation"
          aria-expanded={navOpen}
          aria-controls="admin-nav"
        >
          <Icon name="menu" size={20} />
        </button>
        <Logo />
        <div className="min-w-0 md:border-l md:border-[var(--color-border)] md:pl-3">
          <h1 className="sr-only text-sm leading-tight font-semibold text-[var(--color-ink)] md:not-sr-only">CCTV Design</h1>
          <p className="hidden truncate text-xs text-[var(--color-ink-3)] md:block" title={projectName}>
            {projectName}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenPalette}
            className="hidden items-center gap-2 rounded-control border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2.5 py-1.5 text-sm text-[var(--color-ink-2)] hover:bg-[var(--color-surface-2)] sm:inline-flex"
            aria-keyshortcuts="Control+K Meta+K"
          >
            <Icon name="search" size={16} />
            <span className="hidden lg:inline">Jump to…</span>
            <kbd className="hidden rounded border border-[var(--color-border)] px-1 font-sans text-2xs text-[var(--color-ink-3)] lg:inline">Ctrl K</kbd>
            <span className="sr-only lg:hidden">Jump to…</span>
          </button>
          <UnitsToggle units={units} onChange={onUnits} />
          <ThemeSelect theme={theme} onChange={onTheme} />
        </div>
      </div>
    </header>
  );
}

function NavItem({
  def,
  status,
  active,
  collapsed,
  onClick,
}: {
  def: SectionDef;
  status: SectionStatus | null;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  const s = status ? STATUS_STYLE[status.kind] : null;
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
        title={collapsed ? `${def.label}${status ? ` — ${s?.label}: ${status.text}` : ''}` : undefined}
        className={`relative flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-left text-sm transition-colors ${
          active ? 'bg-[var(--color-accent-soft)] font-semibold text-[var(--color-accent)]' : 'text-[var(--color-ink-2)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]'
        }`}
      >
        {active && <span className="absolute inset-y-1 left-0 w-1 rounded-full bg-[var(--color-brand)]" aria-hidden="true" />}
        <span className="relative">
          <Icon name={def.icon} size={18} />
          {collapsed && s && (
            <span className="absolute -right-1.5 -bottom-1.5 rounded-full bg-[var(--color-surface)]" style={{ color: s.fg }} aria-hidden="true">
              <Icon name={s.icon} size={11} />
            </span>
          )}
        </span>
        <span className={collapsed ? 'sr-only' : 'min-w-0 flex-1'}>
          <span className="block truncate">{def.label}</span>
          {status && s && (
            <span className="flex items-center gap-1 text-xs font-medium" style={{ color: s.fg }}>
              <Icon name={s.icon} size={12} />
              <span className="sr-only">{s.label}: </span>
              <span className="truncate">{status.text}</span>
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

export function AdminNav({
  active,
  statuses,
  onNavigate,
  collapsed,
  onToggleCollapsed,
  drawerOpen,
  onCloseDrawer,
  onOpenPalette,
  sections,
}: {
  active: SectionId;
  statuses: Readonly<Record<SectionId, SectionStatus>>;
  onNavigate: (id: SectionId) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  drawerOpen: boolean;
  onCloseDrawer: () => void;
  onOpenPalette: () => void;
  sections: readonly SectionDef[];
}) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (drawerOpen) ref.current?.querySelector<HTMLElement>('button')?.focus();
  }, [drawerOpen]);
  return (
    <>
      {drawerOpen && <div className="fixed inset-0 z-40 bg-[var(--color-scrim)] lg:hidden" onClick={onCloseDrawer} aria-hidden="true" />}
      <nav
        id="admin-nav"
        ref={ref}
        aria-label="Project sections"
        onKeyDown={(e) => {
          if (e.key === 'Escape' && drawerOpen) onCloseDrawer();
        }}
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] transition-transform duration-[var(--duration-base)] ease-[var(--ease-standard)] lg:sticky lg:top-[3.25rem] lg:z-10 lg:h-[calc(100vh-3.25rem)] lg:translate-x-0 lg:visible ${
          drawerOpen ? 'translate-x-0 visible shadow-[var(--shadow-popover)]' : 'invisible -translate-x-full'
        } ${collapsed ? 'lg:w-16' : 'lg:w-58'}`}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2 lg:hidden">
          <span className="text-sm font-semibold text-[var(--color-ink)]">Sections</span>
          <button type="button" onClick={onCloseDrawer} className="rounded-control p-1.5 text-[var(--color-ink-2)] hover:bg-[var(--color-surface-2)]" aria-label="Close navigation">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="px-2 pt-2 sm:hidden">
          <button
            type="button"
            onClick={onOpenPalette}
            className="flex w-full items-center gap-2 rounded-control border border-[var(--color-border-strong)] px-2.5 py-2 text-sm text-[var(--color-ink-2)]"
          >
            <Icon name="search" size={16} />
            Jump to…
          </button>
        </div>
        <ol className="grid flex-1 content-start gap-0.5 overflow-y-auto p-2">
          {sections.map((def) => (
            <NavItem
              key={def.id}
              def={def}
              status={statuses[def.id]}
              active={active === def.id}
              collapsed={collapsed}
              onClick={() => onNavigate(def.id)}
            />
          ))}
        </ol>
        <ul className="grid gap-0.5 border-t border-[var(--color-border)] p-2">
          <NavItem def={SETTINGS_SECTION} status={null} active={active === 'settings'} collapsed={collapsed} onClick={() => onNavigate('settings')} />
          <li className="hidden lg:block">
            <button
              type="button"
              onClick={onToggleCollapsed}
              className="flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-left text-sm text-[var(--color-ink-3)] hover:bg-[var(--color-surface-2)]"
              aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
              aria-expanded={!collapsed}
            >
              <Icon name="panel-left" size={18} />
              {!collapsed && <span>Collapse</span>}
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}

/** The frame of one section: heading with status, description, content, previous / next. */
export function SectionFrame({
  def,
  status,
  actions,
  children,
  headingRef,
  prev,
  next,
  onNavigate,
}: {
  def: SectionDef;
  status: SectionStatus | null;
  actions?: ReactNode;
  children: ReactNode;
  headingRef: RefObject<HTMLHeadingElement | null>;
  prev: SectionDef | null;
  next: SectionDef | null;
  onNavigate: (id: SectionId) => void;
}) {
  return (
    <div className="@container/section">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 ref={headingRef} tabIndex={-1} className="text-display font-semibold text-[var(--color-ink)] focus:outline-none">
              {def.label}
            </h2>
            {status && <StatusBadge kind={status.kind}>{status.text}</StatusBadge>}
          </div>
          <p className="mt-1 max-w-3xl text-sm text-[var(--color-ink-3)]">{def.description}</p>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
      {(prev || next) && (
        <nav aria-label="Workflow" className="mt-8 flex flex-wrap justify-between gap-3 border-t border-[var(--color-border)] pt-4">
          {prev ? (
            <button type="button" onClick={() => onNavigate(prev.id)} className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-accent)] hover:underline">
              <Icon name="arrow-left" size={16} />
              Previous: {prev.label}
            </button>
          ) : (
            <span />
          )}
          {next && (
            <button type="button" onClick={() => onNavigate(next.id)} className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-accent)] hover:underline">
              Next: {next.label}
              <Icon name="arrow-right" size={16} />
            </button>
          )}
        </nav>
      )}
    </div>
  );
}

