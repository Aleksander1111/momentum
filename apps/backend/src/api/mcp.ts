import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { AutomationName, PutSettings } from '@momentum/contract';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Momentum } from '../momentum.ts';

const json = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value ?? { ok: true }, null, 2) }] });

/** Every capability reachable without the UI: the API's handlers as MCP tools for the user's voice tools */
function createServer(m: Momentum): McpServer {
  const server = new McpServer({ name: 'momentum', version: '0.0.0' });
  const t = <S extends z.ZodRawShape>(name: string, description: string, shape: S, run: (a: z.infer<z.ZodObject<S>>) => Promise<unknown>) =>
    server.registerTool(name, { description, inputSchema: shape }, (async (args: unknown) => json(await run(args as z.infer<z.ZodObject<S>>))) as never);

  t('workspaces', 'List the workspaces and whether each is enabled.', {}, () => m.workspaceList());
  t('feed', 'The attention feed: ranked entities across enabled projects that need the user\'s attention.', {}, () => m.feed());
  t('approve', 'Approve a feed item: its change lands on the main line.', { workspace: z.string(), path: z.string() }, (a) =>
    m.approve(a.workspace, a.path, 0),
  );
  t(
    'send_back',
    'Disapprove a feed item with a comment; the comment starts a chat run on the same branch.',
    { workspace: z.string(), path: z.string(), comment: z.string() },
    (a) => m.sendBack(a.workspace, a.path, a.comment, 0),
  );
  t('entity', 'Read one entity in full.', { workspace: z.string(), path: z.string() }, (a) => m.entity(a.workspace, a.path));
  t('types', 'Browse a workspace\'s entities by type path.', { workspace: z.string() }, (a) => m.types(a.workspace));
  t('search', 'Search a workspace\'s entities.', { workspace: z.string(), query: z.string() }, (a) => m.search(a.workspace, a.query));
  t('chats', 'List the chats of a workspace.', { workspace: z.string() }, (a) => m.chats(a.workspace));
  t(
    'chat',
    'Ask a question or give an instruction: starts a chat run in the workspace.',
    { workspace: z.string(), text: z.string(), target_path: z.string().optional() },
    (a) => m.createChat(a.workspace, a.text, a.target_path),
  );
  t(
    'run_automation',
    'Start an automation on demand in a workspace, when its trigger entity allows it.',
    { workspace: z.string(), automation: AutomationName, prompt: z.string().optional() },
    (a) => m.runAutomation(a.workspace, a.automation, a.prompt),
  );
  t('run', 'A run with its conversation and status.', { id: z.string() }, (a) => m.run(a.id));
  t('message', 'Steer a run or continue a chat.', { id: z.string(), text: z.string() }, (a) => m.postMessage(a.id, a.text));
  t('kill_run', 'End a run: its process is killed; what it wrote so far still reaches the feed.', { id: z.string() }, (a) => m.killRun(a.id));
  t(
    'graph_build',
    'The knowledge graph build of a workspace: state, runs, entities written and the usage it took.',
    { workspace: z.string() },
    (a) => m.graphBuild(a.workspace),
  );
  t(
    'set_graph_build',
    'Stop the knowledge graph build of a workspace, or start it again.',
    { workspace: z.string(), building: z.boolean() },
    (a) => m.setGraphBuild(a.workspace, a.building),
  );
  t(
    'reset_project',
    'Reset a project: every entity and database entry of the workspace is removed and its knowledge graph is built afresh.',
    { workspace: z.string() },
    (a) => m.resetProject(a.workspace),
  );
  t('metrics', 'Attention, understanding, agents and implementation metrics and usage of a workspace.', { workspace: z.string() }, (a) =>
    m.metrics(a.workspace),
  );
  t('settings', 'Read the harness settings.', {}, () => m.getSettings());
  t('update_settings', 'Change harness settings: enabled projects, feed size, cards, lifetimes, agents, models.', PutSettings.shape, (a) =>
    m.putSettings(a as PutSettings),
  );
  return server;
}

export async function mcpHandler(m: Momentum, req: FastifyRequest, reply: FastifyReply): Promise<void> {
  reply.hijack();
  const server = createServer(m);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  reply.raw.on('close', () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req.raw, reply.raw, req.body);
}
