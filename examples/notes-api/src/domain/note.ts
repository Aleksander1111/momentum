import { z } from 'zod';
import { distinctTags } from './tag.js';

/** What a client sends to create or replace a note */
export const NoteInput = z.object({
  title: z.string().trim().min(1, 'a note needs a title').max(200),
  body: z.string().max(20_000).default(''),
  tags: z.array(z.string()).max(20).default([]).transform(distinctTags),
});
export type NoteInput = z.infer<typeof NoteInput>;

/** A note as the store keeps it */
export interface Note extends NoteInput {
  id: number;
  createdAt: string;
  updatedAt: string;
}

/** The fields a client may change on an existing note; what it leaves out stays as it is */
export const NotePatch = z.object({
  title: NoteInput.shape.title.optional(),
  body: z.string().max(20_000).optional(),
  tags: z.array(z.string()).max(20).transform(distinctTags).optional(),
});
export type NotePatch = z.infer<typeof NotePatch>;
