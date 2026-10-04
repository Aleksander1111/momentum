import { loadEntityTypes, type EntityType } from '@momentum/entity';
import { migrateWorkspace, schemaOf, WorkspaceIndex, type Sql } from '@momentum/kb';
import { currentBranch } from '@momentum/runs';
import { config } from './config.ts';
import type { HarnessSettings } from './harness.ts';

export interface Workspace {
  name: string;
  path: string;
  /** The main line: the branch the workspace had checked out when first opened, and the only line runs land on */
  main: string;
  index: WorkspaceIndex;
}

export class NotFound extends Error {}

/** A request the harness refuses in the state it is in */
export class Conflict extends Error {
  readonly statusCode = 409;
}

/** Workspaces on disk and their indices; one schema per workspace */
export class Workspaces {
  private cache = new Map<string, Workspace>();
  /** Workspaces being opened for the first time: callers arriving meanwhile share the one setup of its schema */
  private opening = new Map<string, Promise<Workspace>>();
  readonly types: Map<string, EntityType> = loadEntityTypes(config.entityTypes);

  constructor(
    readonly sql: Sql,
    readonly settings: HarnessSettings,
  ) {}

  async get(name: string): Promise<Workspace> {
    const cached = this.cache.get(name);
    if (cached) return cached;
    const pending = this.opening.get(name) ?? this.open(name).finally(() => this.opening.delete(name));
    this.opening.set(name, pending);
    return pending;
  }

  private async open(name: string): Promise<Workspace> {
    const project = (await this.settings.projects()).find((p) => p.name === name);
    if (!project) throw new NotFound(`No workspace ${name}`);
    await migrateWorkspace(this.sql, name);
    const ws: Workspace = {
      name,
      path: project.path,
      main: await this.settings.mainLine(name, () => currentBranch(project.path)),
      index: new WorkspaceIndex(this.sql, name),
    };
    this.cache.set(name, ws);
    return ws;
  }

  async enabled(): Promise<Workspace[]> {
    return Promise.all((await this.settings.enabled()).map((p) => this.get(p.name)));
  }

  /** Drops the index and metrics database of a workspace: its schema and its runs; the next get creates them afresh */
  async drop(name: string): Promise<void> {
    this.cache.delete(name);
    await this.sql.unsafe(`drop schema if exists ${schemaOf(name)} cascade`);
    await this.sql`delete from harness.run_ref where workspace = ${name}`;
  }

  harness(): Promise<Workspace> {
    return this.get(config.harnessName);
  }
}
