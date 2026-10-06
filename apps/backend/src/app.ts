import { createDiagramRenderer } from '@momentum/entity';
import { connect, createEmbedder, migrateHarness } from '@momentum/kb';
import { Approval } from './approval.ts';
import { Auth } from './auth.ts';
import { Automations } from './automations.ts';
import { config } from './config.ts';
import { createBus } from './events.ts';
import { Guard } from './guard.ts';
import { HarnessSettings } from './harness.ts';
import { Momentum } from './momentum.ts';
import { Orchestrator } from './orchestrator.ts';
import { Runner } from './runner.ts';
import { Timeline } from './timeline.ts';
import { Voice } from './voice/voice.ts';
import { Workspaces } from './workspaces.ts';

/**
 * One back-end: API, orchestrator and consistency guard in one process. `orchestrate: false` builds it for a command
 * beside a running server: its orchestrator never ticks, so nothing is indexed or started twice.
 */
export async function createMomentum(options: { orchestrate?: boolean } = {}) {
  const sql = connect(config.databaseUrl);
  await migrateHarness(sql);
  await sql`create table if not exists harness.run_ref (id text primary key, workspace text not null)`;
  const settings = new HarnessSettings(sql);
  await settings.migrate();
  await settings.discover();
  const bus = createBus();
  const timeline = new Timeline(sql);
  await timeline.migrate();
  timeline.listen(bus);
  const embed = createEmbedder();
  const workspaces = new Workspaces(sql, settings);
  const guard = new Guard(workspaces, settings, bus, createDiagramRenderer(), embed);
  const automations = new Automations(workspaces);
  const runner = new Runner(workspaces, settings, guard, automations, bus, embed, timeline);
  const approval = new Approval(workspaces, settings, guard, runner, bus, timeline);
  const orchestrator = new Orchestrator(workspaces, settings, guard, runner, automations, bus, timeline, options.orchestrate === false);
  const momentum = new Momentum(sql, workspaces, settings, approval, runner, orchestrator, automations, embed, timeline);
  const auth = new Auth(sql);
  // Followed only once the server starts it: the CLI never acts on what is said
  const voice = new Voice(sql, momentum, config.commandStream, config.voiceSources);
  return { sql, settings, bus, timeline, workspaces, guard, automations, runner, approval, orchestrator, momentum, auth, voice };
}
