/**
 * Offers a file to the user through a temporary link, the way a browser saves
 * something that came from a request with a token (a plain link could not send
 * it). The object URL is released on the next turn, once the click has been
 * handled, so the file does not stay in memory for as long as the page lives.
 */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
