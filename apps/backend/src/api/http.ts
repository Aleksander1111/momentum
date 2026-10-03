import fastifyCookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import fastifySwagger from '@fastify/swagger';
import fastifyWebsocket from '@fastify/websocket';
import {
  ApproveRequest,
  ChatsResponse,
  CreateChatRequest,
  EntityDetail,
  ErrorResponse,
  FeedResponse,
  GraphBuildStatus,
  MetricsRange,
  MetricsResponse,
  PostRunMessage,
  PutGraphBuild,
  PutProjectLogo,
  PutSettings,
  RunDetail,
  SearchResult,
  ResolveRequest,
  SendBackRequest,
  WontResolveRequest,
  SessionRequest,
  SessionResponse,
  Settings,
  TypesResponse,
  VoiceUp,
  Workspace,
} from '@momentum/contract';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { existsSync } from 'node:fs';
import { z } from 'zod';
import type { Auth } from '../auth.ts';
import { config } from '../config.ts';
import type { Momentum } from '../momentum.ts';
import type { Voice } from '../voice/voice.ts';
import { Conflict, NotFound } from '../workspaces.ts';
import { mcpHandler } from './mcp.ts';

export const COOKIE = 'momentum_session';
const PUBLIC = new Set(['POST /session']);
const API = /^\/(workspaces|feed|runs|settings|session|mcp|voice)(\/|\?|$)/;

function tokenOf(req: FastifyRequest): string | undefined {
  const bearer = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1];
  return bearer ?? req.cookies[COOKIE];
}

const ws = z.object({ ws: z.string() });
const errors = { 401: ErrorResponse, 404: ErrorResponse };

export async function createHttp(momentum: Momentum, auth: Auth, voice?: Voice) {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await app.register(fastifyCookie);
  await app.register(fastifyWebsocket);
  await app.register(fastifySwagger, {
    openapi: { info: { title: 'Momentum API', version: '0.0.0' } },
    transform: jsonSchemaTransform,
  });

  const spa = existsSync(config.appDist);
  // Files are resolved per request, so a fresh web build is served without a restart
  if (spa) await app.register(fastifyStatic, { root: config.appDist, wildcard: true });

  // Page loads of the web app get the app; the app's own requests get the API
  app.addHook('onRequest', async (req, reply) => {
    const route = `${req.method} ${req.routeOptions.url ?? ''}`;
    const wantsPage = req.method === 'GET' && (req.headers.accept ?? '').includes('text/html');
    if (wantsPage && spa && req.url !== '/openapi.json') return reply.sendFile('index.html');
    if (!API.test(req.url) || PUBLIC.has(route)) return;
    if (!(await auth.check(tokenOf(req)))) return reply.code(401).send({ error: 'Sign in first' });
  });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof NotFound) return reply.code(404).send({ error: err.message });
    if (err instanceof Conflict) return reply.code(409).send({ error: err.message });
    const e = err as { validation?: unknown; statusCode?: number; message: string };
    if (e.validation) return reply.code(400).send({ error: e.message });
    app.log.error(err);
    return reply.code(e.statusCode ?? 500).send({ error: e.message });
  });

  app.get('/openapi.json', { schema: { hide: true } }, async () => app.swagger());

  app.post('/session', { schema: { body: SessionRequest, response: { 200: SessionResponse, 401: ErrorResponse } } }, async (req, reply) => {
    if (!(await auth.verify(req.body.password))) return reply.code(401).send({ error: 'Wrong password' });
    const { token, expiresAt } = await auth.createSession();
    reply.setCookie(COOKIE, token, { httpOnly: true, sameSite: 'strict', path: '/', expires: expiresAt, secure: false });
    return { token, expiresAt: expiresAt.toISOString() };
  });

  app.delete('/session', async (req: FastifyRequest, reply: FastifyReply) => {
    const token = tokenOf(req);
    if (token) await auth.endSession(token);
    reply.clearCookie(COOKIE, { path: '/' });
    return reply.code(204).send();
  });

  app.get('/workspaces', { schema: { response: { 200: z.array(Workspace), ...errors } } }, () => momentum.workspaceList());

  app.get('/feed', { schema: { response: { 200: FeedResponse, ...errors } } }, () => momentum.feed());

  app.post(
    '/feed/:path/approve',
    { schema: { params: z.object({ path: z.string() }), body: ApproveRequest, response: { 204: z.null(), ...errors } } },
    async (req, reply) => {
      await momentum.approve(req.body.workspace, req.params.path, req.body.timeSpentMs);
      return reply.code(204).send(null);
    },
  );

  app.post(
    '/feed/:path/send-back',
    { schema: { params: z.object({ path: z.string() }), body: SendBackRequest, response: { 200: z.object({ runId: z.string() }), ...errors } } },
    (req) => momentum.sendBack(req.body.workspace, req.params.path, req.body.comment, req.body.timeSpentMs),
  );

  app.post(
    '/feed/:path/resolve',
    { schema: { params: z.object({ path: z.string() }), body: ResolveRequest, response: { 200: z.object({ runId: z.string() }), ...errors } } },
    (req) =>
      momentum.resolve(req.body.workspace, req.params.path, { option: req.body.option, comment: req.body.comment }, req.body.timeSpentMs),
  );

  app.post(
    '/feed/:path/wont-resolve',
    { schema: { params: z.object({ path: z.string() }), body: WontResolveRequest, response: { 204: z.null(), ...errors } } },
    async (req, reply) => {
      await momentum.wontResolve(req.body.workspace, req.params.path, req.body.comment, req.body.timeSpentMs);
      return reply.code(204).send(null);
    },
  );

  app.get(
    '/workspaces/:ws/entities/*',
    { schema: { params: ws.extend({ '*': z.string() }), response: { 200: EntityDetail, ...errors } } },
    (req) => momentum.entity(req.params.ws, req.params['*']),
  );

  app.get(
    '/workspaces/:ws/artifact/*',
    { schema: { params: ws.extend({ '*': z.string() }), response: { 200: z.object({ path: z.string(), text: z.string() }), ...errors } } },
    (req) => momentum.artifact(req.params.ws, req.params['*']),
  );

  app.get('/workspaces/:ws/types', { schema: { params: ws, response: { 200: TypesResponse, ...errors } } }, (req) =>
    momentum.types(req.params.ws),
  );

  app.get(
    '/workspaces/:ws/search',
    { schema: { params: ws, querystring: z.object({ q: z.string().default('') }), response: { 200: z.object({ results: z.array(SearchResult) }), ...errors } } },
    (req) => momentum.search(req.params.ws, req.query.q),
  );

  app.get('/workspaces/:ws/chats', { schema: { params: ws, response: { 200: ChatsResponse, ...errors } } }, (req) =>
    momentum.chats(req.params.ws),
  );

  app.post(
    '/workspaces/:ws/chats',
    { schema: { params: ws, body: CreateChatRequest, response: { 200: z.object({ runId: z.string() }), ...errors } } },
    (req) => momentum.createChat(req.params.ws, req.body.text, req.body.targetPath, req.body.context),
  );

  app.get('/runs/:id', { schema: { params: z.object({ id: z.string() }), response: { 200: RunDetail, ...errors } } }, (req) =>
    momentum.run(req.params.id),
  );

  app.post(
    '/runs/:id/messages',
    { schema: { params: z.object({ id: z.string() }), body: PostRunMessage, response: { 202: z.null(), ...errors } } },
    async (req, reply) => {
      await momentum.postMessage(req.params.id, req.body.text, req.body.context);
      return reply.code(202).send(null);
    },
  );

  app.post(
    '/runs/:id/kill',
    { schema: { params: z.object({ id: z.string() }), response: { 204: z.null(), ...errors } } },
    async (req, reply) => {
      await momentum.killRun(req.params.id);
      return reply.code(204).send(null);
    },
  );

  app.get(
    '/workspaces/:ws/metrics',
    { schema: { params: ws, querystring: z.object({ range: MetricsRange.default('30d') }), response: { 200: MetricsResponse, ...errors } } },
    (req) => momentum.metrics(req.params.ws, req.query.range),
  );

  app.get('/workspaces/:ws/graph-build', { schema: { params: ws, response: { 200: GraphBuildStatus, ...errors } } }, (req) =>
    momentum.graphBuild(req.params.ws),
  );

  app.put('/workspaces/:ws/graph-build', { schema: { params: ws, body: PutGraphBuild, response: { 200: GraphBuildStatus, ...errors } } }, (req) =>
    momentum.setGraphBuild(req.params.ws, req.body.building),
  );

  app.post(
    '/workspaces/:ws/reset',
    { schema: { params: ws, response: { 200: GraphBuildStatus, 409: ErrorResponse, ...errors } } },
    (req) => momentum.resetProject(req.params.ws),
  );

  app.put('/workspaces/:ws/logo', { schema: { params: ws, body: PutProjectLogo, response: { 200: Workspace, ...errors } } }, (req) =>
    momentum.setProjectLogo(req.params.ws, req.body.logo),
  );

  app.delete('/workspaces/:ws/logo', { schema: { params: ws, response: { 200: Workspace, ...errors } } }, (req) =>
    momentum.setProjectLogo(req.params.ws, null),
  );

  app.get('/settings', { schema: { response: { 200: Settings, ...errors } } }, () => momentum.getSettings());

  app.put('/settings', { schema: { body: PutSettings, response: { 200: Settings, ...errors } } }, (req) =>
    momentum.putSettings(req.body),
  );

  // Voice: a control socket per app (its target up; status, partial text and outcomes down) and an audio socket per
  // recording, relayed to the command stream on this machine
  const client = z.object({ client: z.string().min(1) });
  app.get('/voice', { websocket: true, schema: { hide: true, querystring: client } }, (socket, req) => {
    if (!voice) return socket.close(1011, 'voice is off');
    const id = (req.query as { client: string }).client;
    const disconnect = voice.connect(id, (m) => socket.send(JSON.stringify(m)));
    socket.on('message', (data: Buffer) => {
      let up: VoiceUp;
      try {
        up = VoiceUp.parse(JSON.parse(data.toString('utf8')));
      } catch {
        return;
      }
      voice.setTarget(id, up.target);
    });
    socket.on('close', disconnect);
  });
  app.get('/voice/audio', { websocket: true, schema: { hide: true, querystring: client } }, (socket, req) => {
    if (!voice) return socket.close(1011, 'voice is off');
    voice.audio((req.query as { client: string }).client, socket);
  });

  // Voice tools: the same handlers as an MCP server over streamable HTTP
  app.all('/mcp', { schema: { hide: true } }, (req, reply) => mcpHandler(momentum, req, reply));

  app.setNotFoundHandler((req, reply) => {
    if (spa && req.method === 'GET') return reply.sendFile('index.html');
    return reply.code(404).send({ error: 'Not found' });
  });

  return app;
}
