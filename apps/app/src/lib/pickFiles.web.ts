import type { PickedFile } from './attachments';

/** A browser file as a data URL */
export function readFile(file: File): Promise<PickedFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name || 'file', data: reader.result as string, size: file.size });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** The input of the dialog open now, if any: the next pick replaces it */
let open: HTMLInputElement | null = null;

/**
 * Web: any files, several at once, handed to `onPicked` once the dialog closes with some; a dialog cancelled hands
 * nothing. The input stays in the page until it delivers or the next pick replaces it: Firefox delivers what was picked
 * only to an input the document holds, and may report the dialog cancelled before the files come.
 */
export function pickFiles(onPicked: (files: PickedFile[]) => void, onError: () => void): void {
  open?.remove();
  const input = document.createElement('input');
  open = input;
  input.type = 'file';
  input.multiple = true;
  input.style.display = 'none';
  document.body.appendChild(input);
  input.addEventListener('change', () => {
    const files = [...(input.files ?? [])];
    input.remove();
    if (open === input) open = null;
    if (files.length) Promise.all(files.map(readFile)).then(onPicked, onError);
  });
  input.click();
}

/**
 * Files pasted into the field or dropped on the composer go to `onFiles`; text pasted stays text. `field` and `area`
 * are the DOM nodes react-native-web renders.
 */
export function listenForFiles(field: unknown, area: unknown, onFiles: (files: PickedFile[]) => void): () => void {
  const take = (list: FileList | null | undefined) => {
    const files = [...(list ?? [])];
    if (files.length) void Promise.all(files.map(readFile)).then(onFiles);
    return files.length > 0;
  };
  const paste = (e: ClipboardEvent) => {
    if (take(e.clipboardData?.files)) e.preventDefault();
  };
  const over = (e: DragEvent) => {
    if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
  };
  const drop = (e: DragEvent) => {
    if (take(e.dataTransfer?.files)) e.preventDefault();
  };
  const f = field as HTMLElement | null;
  const a = area as HTMLElement | null;
  f?.addEventListener('paste', paste);
  a?.addEventListener('dragover', over);
  a?.addEventListener('drop', drop);
  return () => {
    f?.removeEventListener('paste', paste);
    a?.removeEventListener('dragover', over);
    a?.removeEventListener('drop', drop);
  };
}
