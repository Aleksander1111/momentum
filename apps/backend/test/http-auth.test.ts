import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Auth } from '../src/auth.ts';
import type { Momentum } from '../src/momentum.ts';
import { createHttp } from '../src/api/http.ts';

// Every handler the refused requests could reach fails the test if it runs
const called: string[] = [];
const momentum = new Proxy(
  {},
  {
    get: (_t, name: string) => {
      if (name === 'workspaceList') return async () => (called.push(name), []);
      if (name === 'timeline') return { record: async () => {} };
      return async () => {
        called.push(name);
        throw new Error(`${name} ran without a session`);
      };
    },
  },
) as unknown as Momentum;
const auth = { check: async (token?: string) => token === 'good', verify: async () => false } as unknown as Auth;

let app: FastifyInstance;
beforeAll(async () => {
  process.env.LOG_LEVEL = 'silent';
  app = (await createHttp(momentum, auth)) as unknown as FastifyInstance;
  await app.ready();
});
afterAll(() => app.close());

describe('sessions', () => {
  // The router decodes the path; the session check must see the route it matched, not the raw URL
  it.each([
    ['GET', '/workspaces'],
    ['GET', '/%77orkspaces'],
    ['HEAD', '/%77orkspaces'],
    ['GET', '/%77orkspaces/momentum/types'],
    ['POST', '/%77orkspaces/momentum/chats'],
    ['GET', '/%72uns/abc'],
    ['POST', '/%72uns/abc/kill'],
    ['GET', '/%66eed'],
    ['POST', '/%66eed/x/approve'],
    ['PUT', '/%73ettings'],
    ['GET', '/%74imeline'],
    ['DELETE', '/%73ession'],
    ['POST', '/%6dcp'],
    ['GET', '/%76oice?client=x'],
    ['GET', '/%76oice/audio?client=x'],
  ])('refuses %s %s without one', async (method, url) => {
    called.length = 0;
    const res = await app.inject({ method: method as 'GET', url, payload: method === 'GET' || method === 'HEAD' ? undefined : {} });
    expect(res.statusCode).toBe(401);
    expect(called).toEqual([]);
  });

  it('serves a route, encoded or not, with one', async () => {
    for (const url of ['/workspaces', '/%77orkspaces']) {
      const res = await app.inject({ method: 'GET', url, headers: { authorization: 'Bearer good' } });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    }
  });

  it('lets anyone sign in and read the API document', async () => {
    expect((await app.inject({ method: 'POST', url: '/session', payload: { password: 'x' } })).json()).toEqual({ error: 'Wrong password' });
    expect((await app.inject({ method: 'GET', url: '/openapi.json' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/%6fpenapi.json' })).statusCode).toBe(200);
  });
});
