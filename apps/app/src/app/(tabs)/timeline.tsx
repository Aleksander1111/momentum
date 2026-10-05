import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { AutomationName, TimelineActor, TimelineEvent } from '@momentum/contract';
import { api } from '../../lib/api';
import { embedded } from '../../lib/embed';
import { automationLabel, durationMs, pathSegments, usagePct } from '../../lib/format';
import { useWorkspaces } from '../../lib/workspace';
import { C, useTheme, useWide } from '../../ui/theme';
import { T } from '../../ui/Text';
import { Icon, type PATHS } from '../../ui/icons';
import { TypePill } from '../../ui/domains';
import { ProjectLogo, ProjectName } from '../../ui/ProjectLogo';
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
    case 'run_started':
    case 'run_resumed':
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
    case 'run_queued':
    case 'run_requeued':
      return 'clock';
    case 'run_finished':
      return e.facts.commit || e.facts.paths?.length ? 'commit' : 'check';
    case 'changes_landed':
      return 'commit';
  }
  return 'timeline';
}

function facts(e: TimelineEvent): string[] {
  const f = e.facts;
  // The title says what a run did and the issues it raised; here, how many entities it touched
  return [
    f.paths?.length ? `${f.paths.length} ${f.paths.length === 1 ? 'entity' : 'entities'}` : null,
    f.durationMs !== undefined ? took(f.durationMs) : null,
    f.usage?.fiveHour ? `${usagePct(f.usage.fiveHour)} of 5 h` : null,
    f.model ?? null,
    f.risk ? `${f.risk} risk` : null,
    f.timeSpentMs ? `after ${took(f.timeSpentMs)}` : null,
    f.commit ? f.commit.slice(0, 7) : null,
  ].filter((x): x is string => x !== null);
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

/** "Architecture/Component/consistency-guard" → "Consistency guard" of type "Architecture/Component" */
function entityName(path: string): { name: string; type: string } {
  const parts = pathSegments(path);
  const last = (parts.pop() ?? path).replace(/[-_]/g, ' ');
  return { name: last.charAt(0).toUpperCase() + last.slice(1), type: parts.slice(0, 2).join('/') };
}

/** Entities grouped by type, in the order their types first appear, each group sorted by name */
function byType(paths: string[]): [string, { path: string; name: string }[]][] {
  const groups = new Map<string, { path: string; name: string }[]>();
  for (const path of paths) {
    const { name, type } = entityName(path);
    groups.set(type, [...(groups.get(type) ?? []), { path, name }]);
  }
  return [...groups].map(([type, entities]) => [type, entities.sort((x, y) => x.name.localeCompare(y.name))]);
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
  const paths = e.facts.paths?.length ? e.facts.paths : e.path ? [e.path] : [];
  const text = body(e);
  const ws = e.workspace;
  const openEntity = ws && !embedded ? (path: string) => router.push({ pathname: '/explorer/entity', params: { ws, path } }) : null;
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
      {paths.length ? (
        <View style={{ gap: 10 }}>
          <Label>{paths.length === 1 ? 'Entity' : `${paths.length} entities`}</Label>
          {/* By type, as cards show it: the type's coloured pill, then every entity of it */}
          {byType(paths).map(([type, entities]) => (
            <View key={type} style={{ gap: 4, alignItems: 'flex-start' }}>
              {type ? <TypePill type={type} /> : null}
              <View style={{ paddingLeft: 10, gap: 2, alignSelf: 'stretch' }}>
                {entities.map(({ path, name }) =>
                  openEntity ? (
                    <Pressable key={path} onPress={() => openEntity(path)} accessibilityRole="link">
                      {({ hovered }) => (
                        <T style={{ fontSize: 13.5, textDecorationLine: hovered ? 'underline' : 'none' }} numberOfLines={1}>
                          {name}
                        </T>
                      )}
                    </Pressable>
                  ) : (
                    <T key={path} style={{ fontSize: 13.5 }} numberOfLines={1}>
                      {name}
                    </T>
                  ),
                )}
              </View>
            </View>
          ))}
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
  // The user's own events go without a name: everything not marked otherwise is theirs
  const by = e.actor === 'user' ? null : who(e);
  const after = [by, facts(e).join(' · ')].filter(Boolean).join(' · ');
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
        {open ? (
          <T style={{ fontSize: 14, fontWeight: '700' }}>{headline(e)}</T>
        ) : (
          <T numberOfLines={1} style={{ fontSize: 14 }}>
            {headline(e)}
            {after ? <T style={{ color: C.muted, fontSize: 12.5 }}>{`  ${after}`}</T> : null}
          </T>
        )}
        {open ? <Details e={e} /> : null}
      </View>
      {/* The project's logo alone, on the right edge; its name is in the details */}
      {project ? <ProjectLogo name={project} size={16} style={{ marginTop: 1 }} /> : null}
    </Row>
  );
}

/** Everything that happened, newest first and by day: what the user did, every automation run, what the harness did */
export default function Timeline() {
  useTheme();
  const wide = useWide();
  const corner = useCornerRoom();
  const { data: workspaces } = useWorkspaces();
  const [workspace, setWorkspace] = useState<string | null>(null);
  const [actor, setActor] = useState<ActorFilter>('all');

  const q = useInfiniteQuery({
    queryKey: ['timeline', workspace, actor],
    queryFn: ({ pageParam }) =>
      api.timeline({ workspace: workspace ?? undefined, actor: actor === 'all' ? undefined : actor, before: pageParam ?? undefined, limit: PAGE }),
    initialPageParam: null as number | null,
    getNextPageParam: (last) => last.next,
    refetchInterval: 4_000,
  });

  const events = (q.data?.pages ?? []).flatMap((p) => p.events);
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
          options={[ALL, ...(workspaces ?? []).map((w) => w.name)]}
          icon={(o, size) => (o === ALL ? null : <ProjectLogo name={o} size={size} />)}
          onChange={(v) => setWorkspace(v === ALL ? null : v)}
        />
        <Segmented value={actor} options={ACTORS} onChange={setActor} />
      </View>
      {days.map((d, i) => (
        <View key={d.label}>
          <Sect first={i === 0}>{d.label}</Sect>
          <List style={{ paddingVertical: 4 }}>
            {d.events.map((e, k) => (
              <Event key={e.id} e={e} first={k === 0} showProject={workspace === null} />
            ))}
          </List>
        </View>
      ))}
      {q.isSuccess && events.length === 0 ? (
        <T style={{ color: C.muted, fontSize: 14, textAlign: 'center', paddingVertical: 32 }}>Nothing has happened yet</T>
      ) : null}
      {q.hasNextPage ? (
        <Btn
          kind="ghost"
          small
          label={q.isFetchingNextPage ? 'Loading…' : 'Show older'}
          disabled={q.isFetchingNextPage}
          onPress={() => void q.fetchNextPage()}
          style={{ alignSelf: 'center', marginTop: 16 }}
        />
      ) : null}
    </ScrollView>
  );
}
