import { ATTACHMENT_MAX_BYTES, type Attachment } from '@momentum/contract';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { config } from './config.ts';
import { NotFound } from './workspaces.ts';

/** The media type of a file by its name; the agent reads any file, the app shows images inline */
const TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.log': 'text/plain',
  '.md': 'text/markdown',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
  '.xml': 'application/xml',
  '.html': 'text/html',
  '.zip': 'application/zip',
};

export const typeOf = (name: string) => TYPES[extname(name).toLowerCase()] ?? 'application/octet-stream';

/** A file name safe on Windows: no folders, no reserved characters, no trailing dots or spaces */
export function safeName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const clean = base
    .replace(/[<>:"|?*\u0000-\u001f]/g, '_')
    .replace(/[. ]+$/, '')
    .trim()
    .slice(-120);
  return clean && !/^\.+$/.test(clean) ? clean : 'file';
}

/** Where an attachment of a workspace is kept, its own folder holding the file under its own name */
export const attachmentDir = (workspace: string, id: string) => join(config.attachments, workspace, id);
export const attachmentFile = (workspace: string, a: Pick<Attachment, 'id' | 'name'>) => join(attachmentDir(workspace, a.id), a.name);

/**
 * Files attached to chat messages, kept on the PC per workspace. A file is kept as it is uploaded; a message names the
 * ones it carries, and the agent reads them where they are.
 */
export const attachments = {
  async save(workspace: string, name: string, data: string): Promise<Attachment> {
    const bytes = Buffer.from(data.slice(data.indexOf(',') + 1), 'base64');
    if (bytes.length === 0) throw Object.assign(new Error('The file is empty'), { statusCode: 400 });
    if (bytes.length > ATTACHMENT_MAX_BYTES) throw Object.assign(new Error('A file is at most 10 MB'), { statusCode: 400 });
    const id = randomBytes(8).toString('hex');
    const file = safeName(name);
    await mkdir(attachmentDir(workspace, id), { recursive: true });
    await writeFile(join(attachmentDir(workspace, id), file), bytes);
    return { id, name: file, type: typeOf(file), size: bytes.length };
  },

  /** One attachment by its id, as it is kept */
  async get(workspace: string, id: string): Promise<Attachment> {
    const dir = attachmentDir(workspace, id);
    const [name] = /^[0-9a-f]{16}$/.test(id) && existsSync(dir) ? await readdir(dir) : [];
    if (!name) throw new NotFound(`No attachment ${id} in ${workspace}`);
    return { id, name, type: typeOf(name), size: (await stat(join(dir, name))).size };
  },

  /** The attachments a message carries, in the order given; refused when one is not there */
  of(workspace: string, ids: string[]): Promise<Attachment[]> {
    return Promise.all([...new Set(ids)].map((id) => attachments.get(workspace, id)));
  },

  /** Every attachment of a workspace, when it is reset */
  async drop(workspace: string): Promise<void> {
    await rm(join(config.attachments, workspace), { recursive: true, force: true });
  },
};
