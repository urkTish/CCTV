/**
 * Which surface the URL asks for. The hash already carries the project as
 * base64url, whose alphabet has no "/", so a hash starting with "/" can never be
 * a project and is free for routes:
 *
 *   #<base64url project> or empty   → Admin (the engineer's tool)
 *   #/client                        → the client intake wizard
 *   #/intake/<base64url answers>    → Admin, opening a client's intake as a draft
 */

export type Route =
  | { readonly kind: 'admin' }
  | { readonly kind: 'client' }
  | { readonly kind: 'intake'; readonly payload: string };

export const CLIENT_HASH = '#/client';
export const INTAKE_HASH_PREFIX = '#/intake/';

export function parseRoute(hash: string): Route {
  if (hash === CLIENT_HASH || hash.startsWith(`${CLIENT_HASH}?`) || hash === `${CLIENT_HASH}/`) return { kind: 'client' };
  if (hash.startsWith(INTAKE_HASH_PREFIX)) return { kind: 'intake', payload: hash.slice(INTAKE_HASH_PREFIX.length) };
  return { kind: 'admin' };
}
