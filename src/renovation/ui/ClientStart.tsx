/**
 * `#/client` — the client's start page (spec 3.1, 9.1): one big tile per
 * service, CCTV first so the old `#/client` link still leads there in one tap.
 * Build and Fix are announced but not built in Phase 1 (they say so).
 */

import { useEffect, useState } from 'react';

import { Logo, ThemeSelect, type Theme } from '../../ui/admin/AdminChrome.tsx';
import { Icon, type IconName } from '../../ui/icons.tsx';
import { STRINGS } from '../i18n.ts';
import type { Lang } from '../model.ts';

const LANG_KEY = 'contractech-portal.client-lang';

function readLang(): Lang {
  try {
    return globalThis.localStorage?.getItem(LANG_KEY) === 'ar' ? 'ar' : 'en';
  } catch {
    return 'en';
  }
}

export function ClientStart() {
  const [lang, setLang] = useState<Lang>(readLang);
  const [theme, setTheme] = useState<Theme>('system');
  const [open, setOpen] = useState<'build' | 'fix' | 'unsure' | null>(null);
  const t = STRINGS[lang];
  useEffect(() => {
    try {
      globalThis.localStorage?.setItem(LANG_KEY, lang);
    } catch {
      // per-device convenience only
    }
    document.documentElement.lang = lang;
    return () => {
      document.documentElement.lang = 'en';
    };
  }, [lang]);
  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const tiles: { id: 'cctv' | 'renovation' | 'build' | 'fix' | 'unsure'; icon: IconName; href?: string }[] = [
    { id: 'cctv', icon: 'camera', href: '#/client/cctv' },
    { id: 'renovation', icon: 'home', href: `#/client/renovation${lang === 'ar' ? '?lang=ar' : ''}` },
    { id: 'build', icon: 'square' },
    { id: 'fix', icon: 'settings' },
    { id: 'unsure', icon: 'info' },
  ];

  return (
    <div className="min-h-full" dir={t.dir} lang={lang}>
      <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <span dir="ltr" className="flex">
            <Logo />
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              lang={lang === 'en' ? 'ar' : 'en'}
              onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
              className="min-h-9 rounded-control border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2.5 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]"
            >
              {t.otherLang}
            </button>
            <ThemeSelect theme={theme} onChange={setTheme} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="text-display font-semibold text-[var(--color-ink)]">{t.startTitle}</h1>
        <p className="mt-2 text-[var(--color-ink-2)]">{t.startLead}</p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {tiles.map((tile) => {
            const body = (
              <>
                <span className="flex size-11 shrink-0 items-center justify-center rounded-control bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                  <Icon name={tile.icon} size={22} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-semibold text-[var(--color-ink)]">{t.tiles[tile.id].title}</span>
                  <span className="mt-0.5 block text-sm text-[var(--color-ink-2)]">{t.tiles[tile.id].detail}</span>
                </span>
                <Icon name="arrow-right" size={18} className="shrink-0 text-[var(--color-ink-3)] rtl:rotate-180" />
              </>
            );
            const cls =
              'flex min-h-20 w-full items-center gap-3 rounded-card border-2 border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-start shadow-[var(--shadow-card)] transition-colors hover:border-[var(--color-brand)]';
            return (
              <li key={tile.id} className={tile.id === 'unsure' ? 'sm:col-span-2' : ''}>
                {tile.href ? (
                  <a href={tile.href} className={cls}>
                    {body}
                  </a>
                ) : (
                  <button type="button" className={cls} aria-expanded={open === tile.id} onClick={() => setOpen(open === tile.id ? null : (tile.id as 'build' | 'fix' | 'unsure'))}>
                    {body}
                  </button>
                )}
                {open === tile.id && (
                  <p role="status" className="mt-2 rounded-control bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-ink-2)]">
                    {tile.id === 'unsure' ? t.unsureBody : t.comingSoon}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </main>
      <footer className="mx-auto max-w-2xl px-4 pb-10 text-xs text-[var(--color-ink-3)]">
        <a href="#" className="underline">
          {t.staffLink}
        </a>
      </footer>
    </div>
  );
}
