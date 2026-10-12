/** Offer bytes (a ZIP, an image) as a download. Returns an error message instead of throwing. */
export function downloadBytes(fileName: string, bytes: Uint8Array, mime: string): string | null {
  try {
    const url = URL.createObjectURL(new Blob([bytes.slice().buffer as ArrayBuffer], { type: mime }));
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
