// Run in a scenario's environment before its back-end starts: the password, settings, projects enabled and triggers
// approved, through the harness's own code so the world is what the user would have made it
import type { AutomationName, GraphBuildState, PutSettings } from '@momentum/contract';
import { createMomentum } from '../../src/app.ts';
import { TRIGGER_TYPE } from '../../src/automations.ts';

const spec = JSON.parse(process.argv[2]!) as {
  password: string;
  enabled: string[];
  triggers: AutomationName[];
  graphBuild: GraphBuildState;
  settings: PutSettings;
};

const m = await createMomentum();
// Nothing runs here: the scenario's back-end starts the runs once it is up
m.bus.removeAllListeners();
m.orchestrator.tick = async () => {};
await m.auth.setPassword(spec.password);

const current = await m.settings.get();
const { models, ...rest } = spec.settings;
await m.settings.put({ ...rest, models: { ...current.models, ...models } });

await m.guard.indexMainLine(await m.workspaces.harness());
for (const name of spec.enabled) {
  await m.settings.setEnabled(name, true);
  const ws = await m.workspaces.get(name);
  await m.orchestrator.enable(ws);
  await m.settings.setGraphBuild(name, spec.graphBuild);
  for (const t of await ws.index.byType(TRIGGER_TYPE)) {
    if (spec.triggers.includes(t.path.split('/').pop() as AutomationName)) await m.approval.approve(name, t.path, 0);
  }
}
await m.sql.end();
process.exit(0);
