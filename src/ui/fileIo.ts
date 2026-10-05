/**
 * Browser file plumbing: reading an uploaded file and offering a download.
 * FileReader rather than `Blob.text()` / `arrayBuffer()` because it is the
 * widest-supported path (and the one jsdom implements for the tests).
 */

export function readFileAsText(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('The file could not be read.'));
    reader.readAsText(file);
  });
}

export function readFileAsBytes(file: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result;
      resolve(r instanceof ArrayBuffer ? new Uint8Array(r) : new Uint8Array());
    };
    reader.onerror = () => reject(reader.error ?? new Error('The file could not be read.'));
    reader.readAsArrayBuffer(file);
  });
}

/** Offer `text` as a file download. Returns an error message instead of throwing. */
export function downloadText(fileName: string, text: string, mime: string): string | null {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return null;
  } catch (err) {
    return `Could not start the download (${err instanceof Error ? err.message : 'unknown error'}).`;
  }
}
