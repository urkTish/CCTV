/**
 * App shell: one app, two surfaces, chosen by the URL hash (see `ui/route.ts`).
 *
 *   Admin  — the engineer's tool: the workflow as sections, live results.
 *   Client — a start page with a tile per service, and the plain-language
 *            intake wizards an end client fills in (CCTV, renovation).
 *
 * Camera data loads at import time and is validated then, so a bad dataset
 * surfaces as an error (main.tsx) rather than a wrong spec.
 */

import { useEffect, useState } from 'react';

import { ClientApp } from './client/ClientApp.tsx';
import { ClientStart } from './renovation/ui/ClientStart.tsx';
import { RenovationWizard } from './renovation/ui/RenovationWizard.tsx';
import { AdminApp } from './ui/admin/AdminApp.tsx';
import { parseRoute, type Route } from './ui/route.ts';

export default function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));

  // Only an explicit navigation (a link to #/client, or back to the tool) fires
  // hashchange; the Admin rewrites its own hash with replaceState, which does not.
  useEffect(() => {
    const onHash = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (route.kind === 'client') return <ClientStart />;
  if (route.kind === 'client-cctv') return <ClientApp />;
  if (route.kind === 'client-renovation') return <RenovationWizard initialLang={route.lang ?? undefined} />;
  return (
    <AdminApp
      key={route.kind}
      intakePayload={route.kind === 'intake' ? route.payload : null}
      renovationPayload={route.kind === 'renovation-intake' ? route.payload : null}
    />
  );
}
