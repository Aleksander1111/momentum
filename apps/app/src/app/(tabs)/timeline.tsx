import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { ActiveRun, AutomationName, EntityState, TimelineActor, TimelineEvent } from '@momentum/contract';
import { api } from '../../lib/api';
import { embedded } from '../../lib/embed';
import { automationLabel, durationMs, usagePct } from '../../lib/format';
import { openRun } from '../../lib/runs';
import { useEnabledWorkspaces } from '../../lib/workspace';
import { C, useTheme, useWide } from '../../ui/theme';
import { T } from '../../ui/Text';
import { Icon, type PATHS } from '../../ui/icons';
import { EntityRefs, useOpenEntity } from '../../ui/EntityRef';
import { ProjectLogo, ProjectName } from '../../ui/ProjectLogo';
import { STATE_LABEL, StateIcon, Tip } from '../../ui/StateBadge';
import { useCornerRoom } from '../../ui/SettingsButton';
import { Btn, List, Pick, Row, Sect, Segmented } from '../../ui/parts';

const ALL = 'All projects';
const PAGE = 60;
/** Events this recent are marked as new, so what just happened stands out while watching */
const FRESH_MS = 15_000;

type ActorFilter = 'all' | TimelineActor;
const ACTORS: { value: ActorFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'user', label: 'You' },
  { value: 'automation', label: 'Runs' },
  { value: 'harness', label: 'Harness' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Today", "Yesterday", "Mon 28 Sep", with the year when it is not this one */
function dayLabel(d: Date, now = new Date()): string {
  const days = Math.round(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) /
      86_400_000,
  );
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  const year = d.getFullYear() === now.getFullYear() ? '' : ` ${d.getFullYear()}`;
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}${year}`;
}

/** "12 s", "14 min", "2 h 5 min" */
const took = (ms: number) => (ms < 60_000 ? `${Math.max(1, Math.round(ms / 1000))} s` : durationMs(ms));

const who = (e: TimelineEvent) =>
  e.actor === 'user' ? 'You' : e.actor === 'harness' ? 'Harness' : automationLabel((e.automation ?? 'run') as AutomationName);

/** Green for what went through, amber for what was held back or stopped, red for what failed; otherwise by who did it */
function tone(e: TimelineEvent): string {
  switch (e.kind) {
    case 'run_failed':
    case 'sign_in_failed':
      return C.no;
    case 'run_killed':
    case 'sent_back':
    case 'wont_resolve':
      return C.warn;
    case 'run_finished':
    case 'approved':
    case 'resolved':
    case 'graph_build_complete':
      return C.ok;
    case 'changes_landed':
      return e.facts.issues || e.facts.conflicts?.length ? C.warn : C.ok;
  }
  return e.actor === 'user' ? C.stateUpdating : e.actor === 'automation' ? C.stateArtifactAhead : C.muted;
}

/** What happened, at a glance */
function glyph(e: TimelineEvent): keyof typeof PATHS {
  switch (e.kind) {
    case 'signed_in':
    case 'signed_out':
      return 'user';
    case 'sign_in_failed':
      return 'lock';
    case 'approved':
    case 'resolved':
    case 'graph_build_complete':
      return 'check';
    case 'sent_back':
      return 'undo';
    case 'wont_resolve':
    case 'run_failed':
      return 'close';
    case 'chat_started':
      return 'chat';
    case 'message_sent':
      return 'send';
    case 'interview_started':
      return 'mic';
    case 'graph_build_started':
      return 'play';
    case 'graph_build_stopped':
    case 'run_killed':
      return 'stop';
    case 'project_enabled':
    case 'project_disabled':
      return 'power';
    case 'project_reset':
      return 'refresh';
    case 'logo_changed':
    case 'settings_changed':
      return 'settings';
    case 'run_finished':
      return e.facts.commit || e.facts.paths?.length ? 'commit' : 'check';
    case 'changes_landed':
      return 'commit';
  }
  return 'timeline';
}

/** The feed's counters in their order */
const STATES: EntityState[] = ['unverified', 'verified', 'synced', 'entity_ahead', 'artifact_ahead', 'updating'];

/** What the event did to the feed's counts of entities by state: each state that moved, by how much */
function Moves({ e }: { e: TimelineEvent }) {
  const moved = STATES.flatMap((s) => (e.facts.states?.[s] ? [[s, e.facts.states[s]!] as const] : []));
  if (moved.length === 0) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 }}>
      {moved.map(([s, n]) => (
        <Tip key={s} text={`${n > 0 ? '+' : '−'}${Math.abs(n)} ${STATE_LABEL[s].toLowerCase()}`} side="left">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <StateIcon state={s} size={14} />
            <T style={{ color: C.muted, fontSize: 12, fontWeight: '700' }}>{`${n > 0 ? '+' : '−'}${Math.abs(n)}`}</T>
          </View>
        </Tip>
      ))}
    </View>
  );
}

const STARTED_BY: Record<string, string> = { schedule: 'Schedule', event: 'An event', on_demand: 'You' };

/** The facts of an opened event, each under its label */
function factRows(e: TimelineEvent): [string, string][] {
  const f = e.facts;
  const usage = [f.usage?.fiveHour ? `${usagePct(f.usage.fiveHour)} of 5 h` : null, f.usage?.week ? `${usagePct(f.usage.week)} of week` : null]
    .filter(Boolean)
    .join(' · ');
  const rows: [string, string | null][] = [
    ['By', who(e)],
    ['Project', e.workspace],
    ['Started by', f.trigger ? STARTED_BY[f.trigger]! : null],
    ['Took', f.durationMs !== undefined ? took(f.durationMs) : null],
    ['Usage', usage || null],
    ['Model', f.model ? `${f.model}${f.risk ? ` · ${f.risk} risk` : ''}` : null],
    ['Issues', f.issues ? String(f.issues) : null],
    ['Conflicts', f.conflicts?.length ? String(f.conflicts.length) : null],
    ['Read for', f.timeSpentMs ? took(f.timeSpentMs) : null],
    ['Commit', f.commit ? f.commit.slice(0, 7) : null],
  ];
  return rows.filter((r): r is [string, string] => r[1] !== null);
}

/** The detail without what the title already says: a commit message's body, a comment, an error */
function body(e: TimelineEvent): string | null {
  // A stopped run's error only says it was killed, as its title does
  if (!e.detail || (e.kind === 'run_killed' && e.detail.trim() === 'killed')) return null;
  const lines = e.detail.split('\n');
  const first = lines.findIndex((l) => l.trim());
  const head = lines[first]?.trim();
  const rest = head && (head === e.facts.subject || e.title.includes(head)) ? lines.slice(first + 1) : lines;
  return rest.join('\n').trim() || null;
}

function Label({ children }: { children: string }) {
  return <T style={{ color: C.muted, fontSize: 11.5 }}>{children}</T>;
}

function Link({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" hitSlop={6}>
      <T style={{ color: C.accent, fontSize: 13.5, fontWeight: '700' }}>{label}</T>
    </Pressable>
  );
}

/** An opened event: its facts, what the title leaves out, the entities it touched and where to go from it */
function Details({ e }: { e: TimelineEvent }) {
  // What a run wrote, or the one entity a reaction concerns
  const removed = e.facts.removed ?? [];
  const gone = new Set(removed.map((r) => r.path));
  const paths = (e.facts.paths?.length ? e.facts.paths : e.path ? [e.path] : []).filter((p) => !gone.has(p));
  const text = body(e);
  const ws = e.workspace;
  const openEntity = useOpenEntity(ws);
  return (
    <View style={{ marginTop: 8, padding: 12, gap: 12, backgroundColor: C.card, borderRadius: 10 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 }}>
        {factRows(e).map(([label, value]) => (
          <View key={label} style={{ width: '50%', paddingRight: 8 }}>
            <Label>{label}</Label>
            {label === 'Project' ? <ProjectName name={value} style={{ fontSize: 13.5 }} /> : <T style={{ fontSize: 13.5 }}>{value}</T>}
          </View>
        ))}
      </View>
      {text ? <T style={{ fontSize: 13.5, lineHeight: 19 }}>{text}</T> : null}
      {removed.length ? (
        <View style={{ gap: 4 }}>
          <Label>{removed.length === 1 ? 'Removed' : `${removed.length} removed`}</Label>
          {removed.map((r) => (
            <T key={r.path} style={{ fontSize: 13.5 }}>
              {r.title} <T style={{ color: C.muted, fontSize: 12 }}>{r.path}</T>
            </T>
          ))}
        </View>
      ) : null}
      {paths.length ? (
        <View style={{ gap: 10 }}>
          <Label>{paths.length === 1 ? 'Entity' : `${paths.length} entities`}</Label>
          {/* By type, as every list of entities shows them */}
          <EntityRefs workspace={ws} items={paths.map((path) => ({ path }))} />
        </View>
      ) : null}
      {!embedded && (e.runId || (e.path && openEntity)) ? (
        <View style={{ flexDirection: 'row', gap: 18 }}>
          {e.runId ? <Link label="Open run" onPress={() => router.push({ pathname: '/chat/[runId]', params: { runId: e.runId! } })} /> : null}
          {e.path && openEntity && !paths.includes(e.path) ? <Link label="Open entity" onPress={() => openEntity(e.path!)} /> : null}
        </View>
      ) : null}
    </View>
  );
}

/** The title as the row shows it: an approval's check already says it was approved, so only what was approved */
const headline = (e: TimelineEvent) => (e.kind === 'approved' ? e.title.replace(/^Approved\s+“?(.*?)”?$/, '$1') : e.title);

function Event({ e, first, showProject }: { e: TimelineEvent; first: boolean; showProject: boolean }) {
  const [open, setOpen] = useState(false);
  const at = new Date(e.at);
  const project = showProject ? e.workspace : null;
  const fresh = Date.now() - at.getTime() < FRESH_MS;
  return (
    <Row
      first={first}
      onPress={() => setOpen((o) => !o)}
      // One line each, no rules between them; opened, the title wraps and the details follow
      style={{ alignItems: 'flex-start', paddingVertical: 7, borderTopWidth: 0, backgroundColor: fresh ? C.card : undefined }}
    >
      <View style={{ marginTop: 1 }}>
        <Icon name={glyph(e)} size={17} color={tone(e)} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        {/* The title and what the event did to the entities by state; everything else is in the details */}
        <View style={{ flexDirection: 'row', alignItems: open ? 'flex-start' : 'center', gap: 10 }}>
          <T numberOfLines={open ? undefined : 1} style={{ fontSize: 14, fontWeight: open ? '700' : '400', flexShrink: 1 }}>
            {headline(e)}
          </T>
          <Moves e={e} />
        </View>
        {open ? <Details e={e} /> : null}
      </View>
      {/* The project's logo alone, on the right edge; its name is in the details */}
      {project ? <ProjectLogo name={project} size={16} style={{ marginTop: 1 }} /> : null}
    </Row>
  );
}

const QUEUED_BY: Record<ActiveRun['trigger'], string> = { schedule: 'on schedule', event: 'started by an event', on_demand: 'started by you' };

/** A run that has not ended: what it is, how long it has waited or run, and why it was queued */
function Pending({ r, first, showProject }: { r: ActiveRun; first: boolean; showProject: boolean }) {
  const wide = useWide();
  const running = r.status === 'running';
  const since = Date.now() - new Date(running ? (r.startedAt ?? r.queuedAt) : r.queuedAt).getTime();
  const name = automationLabel(r.automation);
  const title = r.title || name;
  const after = [
    title === name ? null : name,
    running ? `running for ${took(since)}` : `waiting for ${took(since)}`,
    QUEUED_BY[r.trigger],
    r.usage.fiveHour ? `${usagePct(r.usage.fiveHour)} of 5 h` : null,
    r.model,
    r.risk ? `${r.risk} risk` : null,
  ].filter(Boolean);
  return (
    <Row
      first={first}
      onPress={embedded ? undefined : () => openRun(r.id, wide)}
      style={{ alignItems: 'flex-start', paddingVertical: 7, borderTopWidth: 0 }}
    >
      <View style={{ marginTop: 1 }}>
        <Icon name={running ? 'play' : 'clock'} size={17} color={C.stateArtifactAhead} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T numberOfLines={1} style={{ fontSize: 14 }}>
          {title}
          <T style={{ color: C.muted, fontSize: 12.5 }}>{`  ${after.join(' · ')}`}</T>
        </T>
      </View>
      {showProject ? <ProjectLogo name={r.workspace} size={16} style={{ marginTop: 1 }} /> : null}
    </Row>
  );
}

/** Automation runs queued and running, which the timeline shows only once something comes of them */
function UnderWay({ runs, showProject }: { runs: ActiveRun[]; showProject: boolean }) {
  const running = runs.filter((r) => r.status === 'running');
  const queued = runs.filter((r) => r.status === 'queued');
  if (runs.length === 0) return <T style={{ color: C.muted, fontSize: 14, textAlign: 'center', paddingVertical: 32 }}>Nothing is queued or running</T>;
  return (
    <>
      {[
        { label: 'Running', runs: running },
        { label: 'Queued', runs: queued },
      ]
        .filter((s) => s.runs.length)
        .map((s, i) => (
          <View key={s.label}>
            <Sect first={i === 0}>{s.label}</Sect>
            <List style={{ paddingVertical: 4 }}>
              {s.runs.map((r, k) => (
                <Pending key={r.id} r={r} first={k === 0} showProject={showProject} />
              ))}
            </List>
          </View>
        ))}
    </>
  );
}

/** Everything that happened, newest first and by day: what the user did, what came of every automation run, what the harness did */
export default function Timeline() {
  useTheme();
  const wide = useWide();
  const corner = useCornerRoom();
  const workspaces = useEnabledWorkspaces();
  const [workspace, setWorkspace] = useState<string | null>(null);
  const [actor, setActor] = useState<ActorFilter>('all');
  // What is queued and running sits beside the timeline, a press away; its count shows on the way there
  const [underWay, setUnderWay] = useState(false);
  const active = useQuery({
    queryKey: ['runs', 'active', workspace],
    queryFn: () => api.activeRuns(workspace ?? undefined),
    refetchInterval: 4_000,
  });
  const activeRuns = active.data?.runs ?? [];
  const runningCount = activeRuns.filter((r) => r.status === 'running').length;
  const queuedCount = activeRuns.length - runningCount;

  const filter = { workspace: workspace ?? undefined, actor: actor === 'all' ? undefined : actor };
  // The newest page alone is polled: what happens shows at once, and a run's event changes in place as it lands and ends
  const newest = useQuery({
    queryKey: ['timeline', workspace, actor],
    queryFn: () => api.timeline({ ...filter, limit: PAGE }),
    refetchInterval: 4_000,
  });
  // Older pages are fetched once each, when asked for, from where the newest page ended at the first ask
  const [anchor, setAnchor] = useState<number | null>(null);
  useEffect(() => setAnchor(null), [workspace, actor]);
  const older = useInfiniteQuery({
    queryKey: ['timeline', workspace, actor, 'before', anchor],
    queryFn: ({ pageParam }) => api.timeline({ ...filter, before: pageParam, limit: PAGE }),
    initialPageParam: anchor ?? 0,
    getNextPageParam: (last) => last.next ?? undefined,
    enabled: anchor !== null,
    staleTime: Infinity,
  });
  // Every event seen stays, in its latest version: one the newest page has moved past is not lost before the older pages
  const seen = useMemo(() => new Map<number, TimelineEvent>(), [workspace, actor]);
  for (const e of older.data?.pages.flatMap((p) => p.events) ?? []) if (!seen.has(e.id)) seen.set(e.id, e);
  for (const e of newest.data?.events ?? []) seen.set(e.id, e);
  const events = [...seen.values()].sort((a, b) => b.at.localeCompare(a.at) || b.id - a.id);
  const more = anchor === null ? newest.data?.next != null : older.hasNextPage;
  const days: { label: string; events: TimelineEvent[] }[] = [];
  for (const e of events) {
    const label = dayLabel(new Date(e.at));
    if (days.at(-1)?.label !== label) days.push({ label, events: [] });
    days.at(-1)!.events.push(e);
  }

  return (
    <ScrollView
      contentContainerStyle={
        wide ? { maxWidth: 860, paddingVertical: 28, paddingHorizontal: 40 } : { paddingTop: 12, paddingHorizontal: 16, paddingBottom: 24 }
      }
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12, paddingRight: corner, zIndex: 10 }}>
        <Pick
          value={workspace ?? ALL}
          options={[ALL, ...workspaces]}
          icon={(o, size) => (o === ALL ? null : <ProjectLogo name={o} size={size} />)}
          onChange={(v) => setWorkspace(v === ALL ? null : v)}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {/* One choice across both: an actor shows the timeline, the other pill what is under way */}
          <Segmented
            value={underWay ? ('' as ActorFilter) : actor}
            options={ACTORS}
            onChange={(a) => {
              setActor(a);
              setUnderWay(false);
            }}
          />
          <Segmented
            value={underWay ? 'under_way' : ''}
            options={[{ value: 'under_way', label: `Queued ${queuedCount}, Running ${runningCount}` }]}
            onChange={() => setUnderWay((u) => !u)}
          />
        </View>
      </View>
      {underWay ? (active.isSuccess ? <UnderWay runs={activeRuns} showProject={workspace === null} /> : null) : null}
      {underWay ? null : days.map((d, i) => (
        <View key={d.label}>
          <Sect first={i === 0}>{d.label}</Sect>
          <List style={{ paddingVertical: 4 }}>
            {d.events.map((e, k) => (
              <Event key={e.id} e={e} first={k === 0} showProject={workspace === null} />
            ))}
          </List>
        </View>
      ))}
      {!underWay && newest.isSuccess && events.length === 0 ? (
        <T style={{ color: C.muted, fontSize: 14, textAlign: 'center', paddingVertical: 32 }}>Nothing has happened yet</T>
      ) : null}
      {!underWay && more ? (
        <Btn
          kind="ghost"
          small
          label={older.isFetching ? 'Loading…' : 'Show older'}
          disabled={older.isFetching}
          onPress={() => (anchor === null ? setAnchor(newest.data?.next ?? null) : void older.fetchNextPage())}
          style={{ alignSelf: 'center', marginTop: 16 }}
        />
      ) : null}
    </ScrollView>
  );
}
