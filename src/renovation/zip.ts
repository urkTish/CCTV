/**
 * A minimal ZIP writer (stored, no compression), pure, so the visual brief
 * pack can be exported as one file without a new dependency. Photos are
 * already compressed (JPEG/PNG) and prompts are small, so "stored" costs
 * little. Names are UTF-8 (general-purpose flag bit 11).
 *
 * Format: PKWARE APPNOTE 6.3.x — local file headers, central directory, end of
 * central directory record. No ZIP64: the pack is capped well below 4 GB.
 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  readonly name: string;
  readonly data: Uint8Array | string;
}

export const MAX_ZIP_BYTES = 1_500_000_000;

/** DOS date/time for the entries (fixed at 2026-01-01 00:00 when not given). */
function dosDateTime(d: Date): { time: number; date: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

export function buildZip(entries: readonly ZipEntry[], when: Date = new Date(2026, 0, 1)): Uint8Array {
  const enc = new TextEncoder();
  const { time, date } = dosDateTime(when);
  const files = entries.map((e) => {
    const data = typeof e.data === 'string' ? enc.encode(e.data) : e.data;
    return { name: enc.encode(e.name.replace(/\\/g, '/')), data, crc: crc32(data) };
  });
  const localSize = files.reduce((s, f) => s + 30 + f.name.length + f.data.length, 0);
  const centralSize = files.reduce((s, f) => s + 46 + f.name.length, 0);
  const total = localSize + centralSize + 22;
  if (total > MAX_ZIP_BYTES) throw new Error(`The pack would be ${(total / 1e6).toFixed(0)} MB, over the ${MAX_ZIP_BYTES / 1e6} MB limit.`);
  const out = new Uint8Array(total);
  const v = new DataView(out.buffer);
  let p = 0;
  const offsets: number[] = [];
  for (const f of files) {
    offsets.push(p);
    v.setUint32(p, 0x04034b50, true);
    v.setUint16(p + 4, 20, true); // version needed
    v.setUint16(p + 6, 0x0800, true); // UTF-8 names
    v.setUint16(p + 8, 0, true); // stored
    v.setUint16(p + 10, time, true);
    v.setUint16(p + 12, date, true);
    v.setUint32(p + 14, f.crc, true);
    v.setUint32(p + 18, f.data.length, true);
    v.setUint32(p + 22, f.data.length, true);
    v.setUint16(p + 26, f.name.length, true);
    v.setUint16(p + 28, 0, true);
    out.set(f.name, p + 30);
    out.set(f.data, p + 30 + f.name.length);
    p += 30 + f.name.length + f.data.length;
  }
  const cdStart = p;
  files.forEach((f, i) => {
    v.setUint32(p, 0x02014b50, true);
    v.setUint16(p + 4, 20, true); // made by
    v.setUint16(p + 6, 20, true);
    v.setUint16(p + 8, 0x0800, true);
    v.setUint16(p + 10, 0, true);
    v.setUint16(p + 12, time, true);
    v.setUint16(p + 14, date, true);
    v.setUint32(p + 16, f.crc, true);
    v.setUint32(p + 20, f.data.length, true);
    v.setUint32(p + 24, f.data.length, true);
    v.setUint16(p + 28, f.name.length, true);
    v.setUint16(p + 30, 0, true);
    v.setUint16(p + 32, 0, true);
    v.setUint16(p + 34, 0, true);
    v.setUint16(p + 36, 0, true);
    v.setUint32(p + 38, 0, true);
    v.setUint32(p + 42, offsets[i]!, true);
    out.set(f.name, p + 46);
    p += 46 + f.name.length;
  });
  v.setUint32(p, 0x06054b50, true);
  v.setUint16(p + 4, 0, true);
  v.setUint16(p + 6, 0, true);
  v.setUint16(p + 8, files.length, true);
  v.setUint16(p + 10, files.length, true);
  v.setUint32(p + 12, p - cdStart, true);
  v.setUint32(p + 16, cdStart, true);
  v.setUint16(p + 20, 0, true);
  return out;
}

/** Read back a stored ZIP's entries (for tests and for importing a results ZIP). */
export function readZip(bytes: Uint8Array): { name: string; data: Uint8Array }[] | null {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const out: { name: string; data: Uint8Array }[] = [];
  for (let n = 0; n < count; n++) {
    if (p + 46 > bytes.length || v.getUint32(p, true) !== 0x02014b50) return null;
    const method = v.getUint16(p + 10, true);
    const size = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const commentLen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    if (method === 0 && local + 30 <= bytes.length) {
      const ln = v.getUint16(local + 26, true);
      const le = v.getUint16(local + 28, true);
      const start = local + 30 + ln + le;
      out.push({ name, data: bytes.subarray(start, start + size) });
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}
