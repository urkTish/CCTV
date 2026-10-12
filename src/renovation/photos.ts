/**
 * Client and survey photos (spec 3.1, 13): location data is stripped on
 * import and nothing is uploaded anywhere.
 *
 * Two layers:
 *   1. `stripImageMetadata` (pure, tested): removes every JPEG APPn segment
 *      except JFIF (APP0) — that is where EXIF (APP1, incl. GPS), XMP (APP1)
 *      and IPTC (APP13) live — and the PNG eXIf / tEXt / zTXt / iTXt / tIME
 *      chunks. The picture itself is untouched.
 *   2. `preparePhoto` (browser): when a canvas is available the photo is
 *      redrawn at most 1600 px on its longer side and re-encoded as JPEG,
 *      which both drops all metadata and keeps project files small. Without a
 *      canvas (tests, very old browsers) layer 1 alone is used.
 *
 * Either way the result records `metadataStripped: true`, and the bytes are
 * read in the browser only (FileReader); no network request is made.
 */

import { bytesToBase64, readImageHeader } from '../domain/planImage.ts';

export const PHOTO_ACCEPT = 'image/jpeg,image/png,.jpg,.jpeg,.png';
export const MAX_PHOTO_BYTES = 25_000_000;
export const PHOTO_MAX_SIDE = 1600;

const PNG_DROP = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);

function isJpeg(b: Uint8Array): boolean {
  return b[0] === 0xff && b[1] === 0xd8;
}
function isPng(b: Uint8Array): boolean {
  return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
}

/** Remove metadata segments / chunks; returns the original bytes when the format is not recognised. */
export function stripImageMetadata(bytes: Uint8Array): Uint8Array {
  if (isJpeg(bytes)) return stripJpeg(bytes);
  if (isPng(bytes)) return stripPng(bytes);
  return bytes;
}

function stripJpeg(b: Uint8Array): Uint8Array {
  const out: number[] = [0xff, 0xd8];
  let i = 2;
  while (i + 3 < b.length) {
    if (b[i] !== 0xff) return b; // not a well-formed marker stream: leave it alone
    const marker = b[i + 1]!;
    if (marker === 0xda) {
      // Start of scan: the rest is image data up to EOI.
      for (let k = i; k < b.length; k++) out.push(b[k]!);
      return Uint8Array.from(out);
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0xff) {
      out.push(0xff, marker);
      i += 2;
      continue;
    }
    const len = ((b[i + 2]! << 8) | b[i + 3]!) >>> 0;
    if (len < 2 || i + 2 + len > b.length) return b;
    const isAppN = marker >= 0xe1 && marker <= 0xef; // APP1..APP15 (APP0 = JFIF kept)
    const isComment = marker === 0xfe;
    if (!isAppN && !isComment) for (let k = i; k < i + 2 + len; k++) out.push(b[k]!);
    i += 2 + len;
  }
  return Uint8Array.from(out);
}

function stripPng(b: Uint8Array): Uint8Array {
  const out: number[] = Array.from(b.subarray(0, 8));
  let i = 8;
  while (i + 12 <= b.length) {
    const len = (((b[i]! << 24) >>> 0) + (b[i + 1]! << 16) + (b[i + 2]! << 8) + b[i + 3]!) >>> 0;
    const type = String.fromCharCode(b[i + 4]!, b[i + 5]!, b[i + 6]!, b[i + 7]!);
    const end = i + 12 + len;
    if (end > b.length) return b;
    if (!PNG_DROP.has(type)) for (let k = i; k < end; k++) out.push(b[k]!);
    i = end;
    if (type === 'IEND') break;
  }
  return Uint8Array.from(out);
}

/** True if the bytes still carry an EXIF block (JPEG APP1 "Exif" or PNG eXIf). */
export function hasExif(b: Uint8Array): boolean {
  if (isJpeg(b)) {
    for (let i = 2; i + 9 < b.length; i++) {
      if (b[i] === 0xff && b[i + 1] === 0xe1 && b[i + 4] === 0x45 && b[i + 5] === 0x78 && b[i + 6] === 0x69 && b[i + 7] === 0x66) return true;
      if (b[i] === 0xff && b[i + 1] === 0xda) return false;
    }
    return false;
  }
  if (isPng(b)) {
    for (let i = 8; i + 8 < b.length; i++) if (b[i + 4] === 0x65 && b[i + 5] === 0x58 && b[i + 6] === 0x49 && b[i + 7] === 0x66) return true;
  }
  return false;
}

export interface PreparedPhoto {
  readonly dataUri: string;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly metadataStripped: true;
}

export type PhotoResult = { readonly ok: true; readonly photo: PreparedPhoto } | { readonly ok: false; readonly reason: string };

/** Pure path: validate the header and strip metadata (no resize). */
export function photoFromBytes(fileName: string, bytes: Uint8Array): PhotoResult {
  if (bytes.length === 0) return { ok: false, reason: `${fileName} is empty.` };
  if (bytes.length > MAX_PHOTO_BYTES) return { ok: false, reason: `${fileName} is ${(bytes.length / 1e6).toFixed(1)} MB; photos up to ${MAX_PHOTO_BYTES / 1e6} MB are accepted.` };
  const header = readImageHeader(bytes);
  if (!header) return { ok: false, reason: `${fileName} is not a JPEG or PNG photo.` };
  const clean = stripImageMetadata(bytes);
  const mime = header.format === 'png' ? 'image/png' : 'image/jpeg';
  return { ok: true, photo: { dataUri: `data:${mime};base64,${bytesToBase64(clean)}`, widthPx: header.widthPx, heightPx: header.heightPx, metadataStripped: true } };
}

/** Longest side scaled to at most `max`, keeping the aspect ratio. */
export function fitWithin(w: number, h: number, max: number): { w: number; h: number } {
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

/**
 * Browser path: strip, then redraw on a canvas (downscaled, re-encoded as
 * JPEG). Falls back to the stripped original when a canvas cannot be used.
 */
export async function preparePhoto(fileName: string, bytes: Uint8Array): Promise<PhotoResult> {
  const pure = photoFromBytes(fileName, bytes);
  if (!pure.ok) return pure;
  const redrawn = await redraw(pure.photo.dataUri, PHOTO_MAX_SIDE).catch(() => null);
  return redrawn ? { ok: true, photo: { ...redrawn, metadataStripped: true } } : pure;
}

function canvasAvailable(): boolean {
  try {
    if (typeof document === 'undefined' || typeof Image === 'undefined') return false;
    // jsdom has HTMLCanvasElement but no 2D context; asking for one logs an error there.
    if (/jsdom/i.test(globalThis.navigator?.userAgent ?? '')) return false;
    return typeof document.createElement('canvas').getContext === 'function';
  } catch {
    return false;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('The image could not be decoded.'));
    img.src = src;
  });
}

async function redraw(src: string, maxSide: number): Promise<{ dataUri: string; widthPx: number; heightPx: number } | null> {
  if (!canvasAvailable()) return null;
  const img = await loadImage(src);
  const { w, h } = fitWithin(img.naturalWidth, img.naturalHeight, maxSide);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  const dataUri = canvas.toDataURL('image/jpeg', 0.85);
  return dataUri.startsWith('data:image/jpeg;base64,') ? { dataUri, widthPx: w, heightPx: h } : null;
}

/** "Illustrative" label, burned into the bottom-left corner of an after image (spec 5.5). */
export const ILLUSTRATIVE_LABEL: Readonly<Record<'en' | 'ar', string>> = {
  en: 'Illustrative visual — for guidance only',
  ar: 'صورة توضيحية — للاسترشاد فقط',
};

/**
 * Burn the label into the image (browser canvas). Returns null when no canvas
 * is available; the caller then keeps `labelBurned: false` and the portal
 * refuses to put the image in a proposal until it is labelled.
 */
export async function burnLabel(src: string, text: string): Promise<{ dataUri: string; widthPx: number; heightPx: number } | null> {
  if (!canvasAvailable()) return null;
  const img = await loadImage(src);
  const { w, h } = fitWithin(img.naturalWidth, img.naturalHeight, 2400);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  const size = Math.max(12, Math.round(w / 48));
  ctx.font = `600 ${size}px system-ui, sans-serif`;
  const pad = Math.round(size * 0.6);
  const tw = ctx.measureText(text).width;
  const bh = size + pad * 2;
  ctx.fillStyle = 'rgba(16, 21, 28, 0.72)';
  ctx.fillRect(pad, h - bh - pad, tw + pad * 2, bh);
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, pad * 2, h - pad - bh / 2);
  const dataUri = canvas.toDataURL('image/jpeg', 0.9);
  return dataUri.startsWith('data:image/jpeg;base64,') ? { dataUri, widthPx: w, heightPx: h } : null;
}

export function dataUriBytes(dataUri: string): Uint8Array {
  const b64 = dataUri.slice(dataUri.indexOf(',') + 1);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function dataUriExt(dataUri: string): 'jpg' | 'png' {
  return dataUri.startsWith('data:image/png') ? 'png' : 'jpg';
}
