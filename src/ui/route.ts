/**
 * Which surface the URL asks for. The hash already carries the project as
 * base64url, whose alphabet has no "/", so a hash starting with "/" can never be
 * a project and is free for routes:
 *
 *   #<base64url project> or empty      → Admin (the engineer's tool)
 *   #/client                           → the client start page (service tiles, CCTV first)
 *   #/client/cctv                      → the CCTV intake wizard
 *   #/client/renovation[?lang=ar]      → the renovation questionnaire
 *   #/intake/<base64url answers>       → Admin, opening a CCTV intake as a draft
 *   #/renovation-intake/<base64url>    → Admin, opening a renovation intake as a draft
 */

export type Route =
  | { readonly kind: 'admin' }
  | { readonly kind: 'client' }
  | { readonly kind: 'client-cctv' }
  | { readonly kind: 'client-renovation'; readonly lang: 'en' | 'ar' | null }
  | { readonly kind: 'intake'; readonly payload: string }
  | { readonly kind: 'renovation-intake'; readonly payload: string };

export const CLIENT_HASH = '#/client';
export const CLIENT_CCTV_HASH = '#/client/cctv';
export const CLIENT_RENOVATION_HASH = '#/client/renovation';
export const INTAKE_HASH_PREFIX = '#/intake/';
export const RENOVATION_INTAKE_HASH_PREFIX = '#/renovation-intake/';

function is(hash: string, base: string): boolean {
  return hash === base || hash === `${base}/` || hash.startsWith(`${base}?`);
}

export function parseRoute(hash: string): Route {
  if (is(hash, CLIENT_CCTV_HASH)) return { kind: 'client-cctv' };
  if (is(hash, CLIENT_RENOVATION_HASH)) {
    const q = hash.split('?')[1] ?? '';
    const lang = new URLSearchParams(q).get('lang');
    return { kind: 'client-renovation', lang: lang === 'ar' || lang === 'en' ? lang : null };
  }
  if (is(hash, CLIENT_HASH)) return { kind: 'client' };
  if (hash.startsWith(INTAKE_HASH_PREFIX)) return { kind: 'intake', payload: hash.slice(INTAKE_HASH_PREFIX.length) };
  if (hash.startsWith(RENOVATION_INTAKE_HASH_PREFIX)) return { kind: 'renovation-intake', payload: hash.slice(RENOVATION_INTAKE_HASH_PREFIX.length) };
  return { kind: 'admin' };
}
