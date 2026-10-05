/**
 * App shell: one app, two surfaces, chosen by the URL hash (see `ui/route.ts`).
 *
 *   Admin  — the engineer's tool: the workflow as sections, live results.
 *   Client — the plain-language intake wizard an end client fills in.
 *
 * Camera data loads at import time and is validated then, so a bad dataset
 * surfaces as an error (main.tsx) rather than a wrong spec.
 */

import { useEffect, useState } from 'react';

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

  return <AdminApp key={route.kind} intakePayload={route.kind === 'intake' ? route.payload : null} />;
}
