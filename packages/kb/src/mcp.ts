import { createSdkMcpServer, tool, type McpSdkServerConfigWithInstance } from '@anthropic-ai/claude-agent-sdk';
import { EntityFrontmatter } from '@momentum/contract';
import { fileOf, serializeEntity, validateText, type ValidationContext } from '@momentum/entity';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import type { Embed } from './embeddings.ts';
import type { WorkspaceIndex } from './workspace-index.ts';

export interface KbServerContext {
  index: WorkspaceIndex;
  embed: Embed;
  /** The workspace's run checkout; reads prefer it and writes land in it, on the main line when the run ends */
  checkout: string;
  runId: string;
  validation: () => Promise<Omit<ValidationContext, 'resolves'>>;
  /** The entity types a path may start with, Domain/Type, with what each is for */
  types?: () => { path: string; description: string }[];
  recordAgentMetric?: (m: { misalignments: number; recurringIssues: number }) => Promise<void>;
}

const text = (value: unknown) => ({
  content: [{ type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
});

/** momentum-kb: the knowledge base for a run, started by the SDK in-process */
export function createKbServer(ctx: KbServerContext): McpSdkServerConfigWithInstance {
  const resolves = (checkout: string) => (p: string) => existsSync(join(checkout, fileOf(p)));
  return createSdkMcpServer({
    name: 'momentum-kb',
    version: '0.0.0',
    tools: [
      tool(
        'search',
        'Search the knowledge base of this workspace (full text + semantic), expanded along references between entities (Graph RAG). Returns entity paths, types, titles and states.',
        { query: z.string().min(1), limit: z.number().int().min(1).max(50).optional(), depth: z.number().int().min(0).max(3).optional() },
        async ({ query, limit, depth }) => {
          const [embedding] = await ctx.embed([query]);
          return text(await ctx.index.retrieve(query, embedding ?? null, limit ?? 10, depth ?? 1));
        },
      ),
      tool(
        'read',
        'Read one entity by path (e.g. Product/Feature/offline-feed): its markdown file as it stands in this run\'s checkout, or from the index when the checkout does not have it.',
        { path: z.string().min(1) },
        async ({ path }) => {
          const file = join(ctx.checkout, fileOf(path));
          if (existsSync(file)) return text(await readFile(file, 'utf8'));
          const d = await ctx.index.detail(path);
          return text(d ? { ...d, card: undefined } : `No entity at ${path}`);
        },
      ),
      tool(
        'references',
        'List the references of an entity in both directions, with the relation type and the title and type of the other end.',
        { path: z.string().min(1) },
        async ({ path }) => text(await ctx.index.neighbours(path)),
      ),
      tool(
        'types',
        'List the entity types (Domain/Type, from entity-types.tsv) with what each is for; a query narrows the list to types whose path or description mentions it. Every entity\'s type is one of these, and its path starts with it.',
        { query: z.string().optional() },
        async ({ query }) => {
          const all = ctx.types?.() ?? [];
          const q = query?.trim().toLowerCase();
          const found = q ? all.filter((t) => t.path.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)) : [];
          return text((found.length ? found : all).map((t) => `${t.path}\t${t.description}`).join('\n'));
        },
      ),
      tool(
        'write',
        'Write an entity to knowledge-graph/<path>.md in this run\'s checkout; it lands on the main line when the run ends. The path starts with the type path (Domain/Type from entity-types.tsv; the types tool lists them). The body is the card without its title, which is written as its heading: free-form markdown within the configured character limit, in the form that presents the entity best. Returns validation issues, which the consistency guard will also raise.',
        {
          path: z.string().min(1),
          title: z.string().min(1),
          body: z.string(),
          frontmatter: z.record(z.string(), z.unknown()),
        },
        async ({ path, title, body, frontmatter }) => {
          const fm = EntityFrontmatter.safeParse(frontmatter);
          if (!fm.success) return text(`Frontmatter rejected: ${fm.error.message}`);
          // The title is the card's heading already: a body starting with it again would show it twice
          const heading = /^\s*#[ \t]+(.+?)[ \t]*(?:\r?\n|$)/.exec(body);
          const card = heading && heading[1]!.toLowerCase() === title.trim().toLowerCase() ? body.slice(heading[0].length).replace(/^\s+/, '') : body;
          const markdown = serializeEntity({ frontmatter: fm.data, title, body: card });
          const file = join(ctx.checkout, fileOf(path));
          await mkdir(dirname(file), { recursive: true });
          await writeFile(file, markdown, 'utf8');
          const { issues } = validateText(path, markdown, { ...(await ctx.validation()), resolves: resolves(ctx.checkout) });
          return text(issues.length === 0 ? `Wrote ${fileOf(path)}` : { wrote: fileOf(path), issues });
        },
      ),
      tool(
        'record_agent_metric',
        'Record what this run found about the automations: misalignments with the user found in chats, and issues that recur.',
        { misalignments: z.number().int().min(0), recurring_issues: z.number().int().min(0) },
        async ({ misalignments, recurring_issues }) => {
          await ctx.recordAgentMetric?.({ misalignments, recurringIssues: recurring_issues });
          return text('Recorded');
        },
      ),
    ],
  });
}
