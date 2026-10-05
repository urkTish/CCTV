import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './index.css';
import App from './App.tsx';
import { CameraDataError } from './data/cameras.ts';

const container = document.getElementById('root');
if (!container) {
  throw new Error('index.html is missing its #root element');
}

/**
 * The dataset is validated at import time. If it is bad, the only honest thing to
 * do is say so loudly rather than render a half-populated spec sheet — an
 * engineer quotes a client directly off this screen.
 */
try {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch (err) {
  const detail =
    err instanceof CameraDataError || err instanceof Error ? err.message : String(err);
  container.innerHTML = '';
  const panel = document.createElement('div');
  panel.setAttribute('role', 'alert');
  panel.style.cssText =
    'margin:2rem auto;max-width:48rem;padding:1.25rem;border-left:4px solid #a52121;' +
    'background:#fbe6e6;color:#5c1212;font-family:system-ui,sans-serif;border-radius:.5rem';
  const heading = document.createElement('strong');
  heading.textContent = 'The camera dataset failed to load, so nothing is being shown.';
  const body = document.createElement('pre');
  body.style.cssText = 'margin:.75rem 0 0;white-space:pre-wrap;font-size:.85rem';
  body.textContent = detail;
  panel.append(heading, body);
  container.append(panel);
  throw err;
}
