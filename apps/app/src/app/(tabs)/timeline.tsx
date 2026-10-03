import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { AutomationName, TimelineActor, TimelineEvent } from '@momentum/contract';
import { api } from '../../lib/api';
import { embedded } from '../../lib/embed';
import { automationLabel, durationMs, usagePct } from '../../lib/format';
import { useWorkspaces } from '../../lib/workspace';
import { C, F, useTheme, useWide } from '../../ui/theme';
import { T } from '../../ui/Text';
import { Icon, type PATHS } from '../../ui/icons';
import { useCornerRoom } from '../../ui/SettingsButton';
import { Btn, Chevron, List, Pick, Row, Sect, Segmented } from '../../ui/parts';

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

function Event({ e, first, showProject }: { e: TimelineEvent; first: boolean; showProject: boolean }) {
  const [open, setOpen] = useState(false);
  const at = new Date(e.at);
  const paths = e.facts.paths ?? [];
  const canOpen = !embedded && (e.runId !== null || (e.path !== null && e.workspace !== null));
  const more = e.detail !== null || paths.length > 0 || canOpen;
  const sub = [who(e), showProject ? e.workspace : null, ...facts(e)].filter(Boolean).join(' · ');
  const fresh = Date.now() - at.getTime() < FRESH_MS;
  return (
    <Row
      first={first}
      onPress={more ? () => setOpen((o) => !o) : undefined}
      // One line each, no rules between them; opened, the line wraps and the detail follows
      style={{ alignItems: 'flex-start', paddingVertical: 7, borderTopWidth: 0, backgroundColor: fresh ? C.card : undefined }}
    >
      <View style={{ marginTop: 1 }}>
        <Icon name={glyph(e)} size={17} color={tone(e)} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T numberOfLines={open ? undefined : 1} style={{ fontSize: 14 }}>
          {e.title}
          <T style={{ color: C.muted, fontSize: 12.5 }}>{`  ${sub}`}</T>
        </T>
        {open ? (
          <View style={{ marginTop: 8, gap: 8 }}>
            {e.detail ? <T style={{ fontSize: 13.5, color: C.ink }}>{e.detail}</T> : null}
            {paths.length ? (
              <View>
                {paths.slice(0, 12).map((p) => (
                  <T key={p} style={{ fontFamily: F.mono, fontSize: 12, color: C.muted }}>
                    {p}
                  </T>
                ))}
                {paths.length > 12 ? <T style={{ fontSize: 12, color: C.muted }}>{`and ${paths.length - 12} more`}</T> : null}
              </View>
            ) : null}
            {canOpen ? (
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {e.runId ? (
                  <Btn small kind="ghost" label="Open run" onPress={() => router.push({ pathname: '/chat/[runId]', params: { runId: e.runId! } })} />
                ) : null}
                {e.path && e.workspace ? (
                  <Btn
                    small
                    kind="ghost"
                    label="Open entity"
                    onPress={() => router.push({ pathname: '/explorer/entity', params: { ws: e.workspace!, path: e.path! } })}
                  />
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      {more ? <Chevron open={open} style={{ marginTop: 5 }} /> : null}
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
