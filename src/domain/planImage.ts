/**
 * Turning an uploaded file into a `PlanImage` (M1). Pure: it works on the
 * file's bytes, so it runs the same in a browser and in a test.
 *
 * The file's own bytes decide what it is, not its name or the browser's MIME
 * guess: a PNG must start with the PNG signature and a JPEG with SOI, and the
 * pixel size is read straight out of the PNG IHDR chunk / the JPEG SOF marker.
 * That also means no image decoding is needed to learn the size.
 *
 * PDF: rendering a PDF page needs a PDF engine (pdf.js, about 1 MB), which this
 * offline tool does not ship. A PDF is therefore refused with a clear message
 * telling the engineer to export the page as PNG or JPG. See ASSUMPTIONS 11.1.
 */

import type { PlanImage } from './sitePlan.ts';

/** Base64 grows data by 4/3; the project file caps the data URI at 30 MB (projectSchemas). */
export const MAX_PLAN_IMAGE_BYTES = 22_000_000;
export const MAX_PLAN_IMAGE_SIDE_PX = 40_000;

export const PLAN_UPLOAD_ACCEPT = 'image/png,image/jpeg,.png,.jpg,.jpeg,application/pdf,.pdf';

export const PDF_UNSUPPORTED_MESSAGE =
  'PDF plans are not supported: this offline tool does not include a PDF renderer. ' +
  'Open the PDF, export or screenshot the page as PNG or JPG, and upload that.';

export type PlanImageFormat = 'png' | 'jpeg';

export interface ImageHeader {
  readonly format: PlanImageFormat;
  readonly widthPx: number;
  readonly heightPx: number;
}

export type PlanImageResult = { readonly ok: true; readonly image: PlanImage } | { readonly ok: false; readonly reason: string };

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function isPdf(bytes: Uint8Array): boolean {
  // "%PDF"
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

function u16be(b: Uint8Array, i: number): number {
  return ((b[i] ?? 0) << 8) | (b[i + 1] ?? 0);
}

function u32be(b: Uint8Array, i: number): number {
  return (((b[i] ?? 0) << 24) >>> 0) + ((b[i + 1] ?? 0) << 16) + ((b[i + 2] ?? 0) << 8) + (b[i + 3] ?? 0);
}

function pngHeader(b: Uint8Array): ImageHeader | null {
  if (b.length < 24 || !PNG_SIGNATURE.every((v, i) => b[i] === v)) return null;
  // The first chunk must be IHDR: length(4) "IHDR"(4) width(4) height(4).
  if (b[12] !== 0x49 || b[13] !== 0x48 || b[14] !== 0x44 || b[15] !== 0x52) return null;
  return { format: 'png', widthPx: u32be(b, 16), heightPx: u32be(b, 20) };
}

/** SOF0–SOF15 except DHT (C4), JPG (C8) and DAC (CC), which are not frame headers. */
function isSof(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
}

function jpegHeader(b: Uint8Array): ImageHeader | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 3 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1] ?? 0;
    if (marker === 0xff) {
      i += 1; // fill byte
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2; // standalone markers, no length
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null; // EOI / start of scan before any SOF
    const len = u16be(b, i + 2);
    if (len < 2) return null;
    if (isSof(marker)) {
      if (i + 8 >= b.length) return null;
      // length(2) precision(1) height(2) width(2)
      return { format: 'jpeg', heightPx: u16be(b, i + 5), widthPx: u16be(b, i + 7) };
    }
    i += 2 + len;
  }
  return null;
}

/** Format and pixel size read from the file's own header bytes, or null. */
export function readImageHeader(bytes: Uint8Array): ImageHeader | null {
  return pngHeader(bytes) ?? jpegHeader(bytes);
}

export function bytesToBase64(bytes: Uint8Array): string {
  // Chunked so a 20 MB image does not overflow the argument list.
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** Quick check on the browser's file metadata, before reading any bytes. */
export function checkPlanFile(file: { readonly name: string; readonly type: string; readonly size: number }): string | null {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) return PDF_UNSUPPORTED_MESSAGE;
  return sizeCheck(file.name, file.size);
}

function sizeCheck(name: string, size: number): string | null {
  if (size === 0) return `${name} is empty.`;
  if (size > MAX_PLAN_IMAGE_BYTES) {
    return `${name} is ${(size / 1e6).toFixed(1)} MB; plans up to ${MAX_PLAN_IMAGE_BYTES / 1e6} MB are accepted. Downscale it first.`;
  }
  return null;
}

export function planImageFromBytes(fileName: string, bytes: Uint8Array): PlanImageResult {
  if (isPdf(bytes)) return { ok: false, reason: PDF_UNSUPPORTED_MESSAGE };
  const sizeProblem = sizeCheck(fileName, bytes.length);
  if (sizeProblem) return { ok: false, reason: sizeProblem };
  const header = readImageHeader(bytes);
  if (!header) {
    return { ok: false, reason: `${fileName} is not a PNG or JPEG image (its contents do not start with a PNG or JPEG header).` };
  }
  const { widthPx, heightPx } = header;
  if (widthPx < 1 || heightPx < 1 || widthPx > MAX_PLAN_IMAGE_SIDE_PX || heightPx > MAX_PLAN_IMAGE_SIDE_PX) {
    return { ok: false, reason: `${fileName} reports ${widthPx} × ${heightPx} px; each side must be 1 to ${MAX_PLAN_IMAGE_SIDE_PX} px.` };
  }
  const mime = header.format === 'png' ? 'image/png' : 'image/jpeg';
  return {
    ok: true,
    image: {
      dataUri: `data:${mime};base64,${bytesToBase64(bytes)}`,
      widthPx,
      heightPx,
      fileName: fileName.slice(0, 260),
    },
  };
}
