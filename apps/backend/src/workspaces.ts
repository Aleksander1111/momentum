import { loadEntityTypes, type EntityType } from '@momentum/entity';
import { migrateWorkspace, WorkspaceIndex, type Sql } from '@momentum/kb';
import { currentBranch } from '@momentum/runs';
import { config } from './config.ts';
import type { HarnessSettings } from './harness.ts';

export interface Workspace {
  name: string;
  path: string;
  /** The main line: the branch the workspace has checked out */
  main: string;
  index: WorkspaceIndex;
}

export class NotFound extends Error {}

/** Workspaces on disk and their indices; one schema per workspace */
export class Workspaces {
  private cache = new Map<string, Workspace>();
  readonly types: Map<string, EntityType> = loadEntityTypes(config.entityTypes);

  constructor(
    readonly sql: Sql,
    readonly settings: HarnessSettings,
  ) {}

  async get(name: string): Promise<Workspace> {
    const cached = this.cache.get(name);
    if (cached) return cached;
    const project = (await this.settings.projects()).find((p) => p.name === name);
    if (!project) throw new NotFound(`No workspace ${name}`);
    await migrateWorkspace(this.sql, name);
    const ws: Workspace = {
      name,
      path: project.path,
      main: await currentBranch(project.path),
      index: new WorkspaceIndex(this.sql, name),
    };
    this.cache.set(name, ws);
    return ws;
  }

  async enabled(): Promise<Workspace[]> {
    return Promise.all((await this.settings.enabled()).map((p) => this.get(p.name)));
  }

  harness(): Promise<Workspace> {
    return this.get(config.harnessName);
  }
}
