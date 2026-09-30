import { createHttp } from './api/http.ts';
import { createMomentum } from './app.ts';
import { config } from './config.ts';

const host = config.host();
const m = await createMomentum();
if (!(await m.auth.hasPassword())) {
  console.error('No password set. Run: pnpm momentum set-password');
  process.exit(1);
}
// The harness workspace is indexed first: it holds the definitions every workspace uses
await m.guard.indexMainLine(await m.workspaces.harness());
for (const ws of await m.workspaces.enabled()) await m.automations.materialize(ws);
const http = await createHttp(m.momentum, m.auth);
await http.listen({ host, port: config.port });
m.orchestrator.start();

const shutdown = async () => {
  m.orchestrator.stop();
  await http.close();
  await m.sql.end();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
