import { useSyncExternalStore } from 'react';
import { ATTACHMENT_MAX_BYTES, ATTACHMENTS_PER_MESSAGE, type Attachment } from '@momentum/contract';
import { api, HttpError, NetworkError } from './api';

/** A file picked, pasted or dropped: a data URL, and its size in bytes */
export interface PickedFile {
  name: string;
  data: string;
  size: number;
}

/**
 * A file waiting in a project's composer: uploading, kept on the PC once `attachment` is set, or refused with `error`.
 * Images keep their data URL for the chip's thumbnail.
 */
export interface PendingFile {
  key: string;
  workspace: string;
  name: string;
  size: number;
  preview: string | null;
  attachment: Attachment | null;
  error: string | null;
}

let items: PendingFile[] = [];
let next = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const update = (key: string, change: Partial<PendingFile>) => {
  items = items.map((i) => (i.key === key ? { ...i, ...change } : i));
  emit();
};

const why = (e: unknown) =>
  e instanceof NetworkError ? 'Momentum cannot be reached' : e instanceof HttpError ? e.message : 'Not uploaded';

/** Files attached to the chat composer of each project: they go with the next message sent there */
export const chatFiles = {
  /** Uploads each file at once, so the message only names them */
  add(workspace: string, files: PickedFile[]) {
    for (const f of files) {
      const key = `f${next++}`;
      const room = items.filter((i) => i.workspace === workspace && !i.error).length < ATTACHMENTS_PER_MESSAGE;
      const error = !room
        ? `At most ${ATTACHMENTS_PER_MESSAGE} files a message`
        : f.size > ATTACHMENT_MAX_BYTES
          ? 'Over 10 MB'
          : f.size === 0
            ? 'Empty'
            : null;
      const preview = /^data:image\/(png|jpeg|gif|webp);/.test(f.data) ? f.data : null;
      items = [...items, { key, workspace, name: f.name, size: f.size, preview, attachment: null, error }];
      emit();
      if (error) continue;
      api.attach(workspace, { name: f.name, data: f.data }).then(
        (attachment) => update(key, { attachment }),
        (e) => update(key, { error: why(e) }),
      );
    }
  },
  remove(key: string) {
    items = items.filter((i) => i.key !== key);
    emit();
  },
  /** Taken once a message carried them */
  clear(workspace: string) {
    items = items.filter((i) => i.workspace !== workspace);
    emit();
  },
};

/** The ids of the files ready to go */
export const attachmentIds = (files: PendingFile[]) => files.flatMap((f) => (f.attachment ? [f.attachment.id] : []));
export const uploading = (files: PendingFile[]) => files.some((f) => !f.attachment && !f.error);

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** The files waiting in the composer of a project */
export function useChatFiles(workspace: string | null): PendingFile[] {
  const all = useSyncExternalStore(subscribe, () => items, () => items);
  return workspace ? all.filter((i) => i.workspace === workspace) : [];
}

/** A size as the chips read it */
export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
