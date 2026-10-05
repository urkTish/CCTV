/**
 * ContracTech brand — the single place brand assets and values are exported from.
 *
 * All files live under `src/assets/brand/` so the build is self-contained and
 * works offline. The two `*-original.*` files are byte-identical copies of the
 * company's source files and are kept untouched for reference; everything the app
 * uses is derived from them by the processing described in ASSUMPTIONS.md.
 *
 * The stamp is prepared for the client report (built later) and is deliberately
 * NOT used anywhere in the UI yet.
 */

import logoLightUrl from './assets/brand/contractech-logo-light.png';
import logoDarkUrl from './assets/brand/contractech-logo-dark.png';
import stampUrl from './assets/brand/contractech-stamp.png';

export const COMPANY_NAME = 'ContracTech';

/** Page title used by the app shell. */
export const APP_TITLE = 'ContracTech — CCTV Design';

/**
 * Logo for LIGHT backgrounds: dark grey (#333333) wordmark, blue swoosh,
 * transparent background, tightly cropped (693 x 208 px).
 */
export const LOGO_LIGHT_URL: string = logoLightUrl;

/**
 * Logo for DARK backgrounds: same artwork with the wordmark lightened to
 * #EEF2F6. The swoosh pixels are untouched.
 */
export const LOGO_DARK_URL: string = logoDarkUrl;

/**
 * Company stamp, transparent background, full resolution (1024 x 1024 px).
 * For the client report only. Eyeball it before it goes on an official document
 * — see ASSUMPTIONS.md section 9.
 */
export const STAMP_URL: string = stampUrl;

/**
 * Brand blue, sampled from the logo swoosh: the median colour of the 3,007
 * fully-opaque swoosh pixels in the source JPEG. Recorded, not yet applied to the
 * app theme. Because the source is a JPEG, treat the last digit of each channel
 * as approximate; if the company has an official brand-guide hex, prefer it.
 */
export const BRAND_BLUE = '#536FFC';

/** Logo intrinsic size, so layout can reserve space before the image loads. */
export const LOGO_INTRINSIC = { width: 693, height: 208 } as const;

/** File names, relative to `src/assets/brand/`, for tooling and tests. */
export const BRAND_FILES = {
  logoLight: 'contractech-logo-light.png',
  logoDark: 'contractech-logo-dark.png',
  stamp: 'contractech-stamp.png',
  logoOriginal: 'fulllogo-original.jpg',
  stampOriginal: 'company-stamp-original.png',
} as const;
