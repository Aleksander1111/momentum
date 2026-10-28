import { ask } from '@momentum/runs';
import { config } from './config.ts';
import { SAY } from './protocol.ts';
import type { Workspace } from './workspaces.ts';

/** Names a chat; a short call over its messages, it needs no stronger model */
export const NAMER = 'haiku';
/** How much of what the user asked and the agent answered the namer reads: the latest of each */
const TEXT_CHARS = 4000;
const MAX_NAME = 80;

/** The question that names a chat after what was done in it */
export function namingQuestion(asked: string[], answered: string[], landed: string[]): { system: string; prompt: string } {
  const system = `You ${SAY.nameChat} after what was done in it: what was changed, answered or decided, never the question as the user asked it. Answer with the name alone, in a few words like the subject of a commit: at most 60 characters, no quotes, no full stop at the end.`;
  const prompt = [
    `# The user asked\n\n${asked.join('\n\n').slice(-TEXT_CHARS)}`,
    `# The agent answered\n\n${answered.join('\n\n').slice(-TEXT_CHARS)}`,
    ...(landed.length ? [`# Entities it changed on the main line\n\n${landed.map((p) => `- ${p}`).join('\n')}`] : []),
  ].join('\n\n');
  return { system, prompt };
}

/** The name in the namer's answer: its first line, without quotes or a closing full stop */
export function parseName(answer: string): string | null {
  const line = answer
    .split('\n')
    .map((l) => l.trim())
    .find(Boolean)
    ?.replace(/^["“'`]+|["”'`]+$/g, '')
    .replace(/\.$/, '')
    .trim();
  return line ? line.slice(0, MAX_NAME) : null;
}

/**
 * A chat named after what was done in it so far, once a turn of it has ended: the harness names it, so the agent spends
 * nothing on it. Null when there is nothing to name it after yet.
 */
export async function nameChat(ws: Workspace, runId: string): Promise<string | null> {
  const t = (table: string) => ws.index.sql(`${ws.index.schema}.${table}`);
  const messages = await ws.index.sql<{ role: string; text: string }[]>`
    select role, text from ${t('run_message')} where run_id = ${runId} order by seq`;
  const asked = messages.filter((m) => m.role === 'user').map((m) => m.text);
  const answered = messages.filter((m) => m.role === 'assistant').map((m) => m.text);
  if (asked.length === 0 || answered.length === 0) return null;
  const landed = await ws.index.sql<{ path: string }[]>`
    select distinct unnest(paths) as path from ${t('transaction')} where run_id = ${runId} order by path`;
  const q = namingQuestion(asked, answered, landed.map((l) => l.path));
  const name = parseName(await ask({ cwd: ws.path, ...q, model: NAMER, limits: config.limits, procgov: config.procgov }));
  if (!name) return null;
  await ws.index.sql`update ${t('run')} set title = ${name} where id = ${runId}`;
  return name;
}
