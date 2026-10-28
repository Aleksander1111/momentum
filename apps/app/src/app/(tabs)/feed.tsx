import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useMutationState, useQuery } from '@tanstack/react-query';
import type { FeedCounts, FeedResponse, Sync, Verification } from '@momentum/contract';
import { api } from '../../lib/api';
import { REACTIONS, type ApproveVars } from '../../lib/query';
import { withoutItem } from '../../lib/feed';
import { entityKey } from '../../lib/format';
import { C, useTheme, useWide } from '../../ui/theme';
import { H, T } from '../../ui/Text';
import { CardScreen, cardFrame, cardSkin } from '../../ui/CardScreen';
import { Btn } from '../../ui/parts';
import { STATE_LABEL, StateIcon, Tip, type State } from '../../ui/StateBadge';
import { useWorkspaces } from '../../lib/workspace';
import { router, useFocusEffect, useNavigation } from 'expo-router';

const VERIFICATION: Verification[] = ['unverified', 'verified'];
const SYNC: Sync[] = ['synced', 'entity_ahead', 'artifact_ahead', 'updating'];

/** Entities of the enabled projects by state, verification and sync in one segment each; each state is named on hover or long-press. */
function Counters({ counts, wide }: { counts: FeedCounts; wide: boolean }) {
  const item = (state: State, n: number) => (
    <Tip key={state} text={`${n} ${STATE_LABEL[state].toLowerCase()}`} touch>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: n ? 1 : 0.35 }}>
        <StateIcon state={state} />
        <T style={{ color: C.ink, fontSize: 12, fontWeight: '700' }}>{n}</T>
      </View>
    </Tip>
  );
  const segment = (items: [State, number][]) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: C.card,
        borderRadius: 999,
        paddingVertical: 4,
        paddingHorizontal: 12,
      }}
    >
      {items.map(([s, n]) => item(s, n))}
    </View>
  );
  return (
    <View
      style={
        wide
          ? { alignSelf: 'center', width: 560, paddingTop: 22, flexDirection: 'row', gap: 8 }
          : { paddingLeft: 16, paddingRight: 16, paddingTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }
      }
    >
      {segment(VERIFICATION.map((v) => [v, counts.verification[v]]))}
      {segment(SYNC.map((v) => [v, counts.sync[v]]))}
    </View>
  );
}

/** What the feed says without a card: where cards come from, or that nothing needs the user now */
function Empty({ included }: { included: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 10 }}>
      <H style={{ fontSize: 20, textAlign: 'center' }}>{included ? 'Nothing needs you right now' : 'No project included yet'}</H>
      <T style={{ color: C.muted, fontSize: 14.5, lineHeight: 21, textAlign: 'center', maxWidth: 340 }}>
        {included
          ? 'Cards show up here as the runs write what needs your review.'
          : 'Include a project in Settings: Momentum maps it into a knowledge graph, and what needs your review shows up here.'}
      </T>
      {included ? null : <Btn label="Open Settings" kind="primary" onPress={() => router.navigate('/settings')} style={{ marginTop: 8 }} />}
    </View>
  );
}

export default function Feed() {
  useTheme();
  const wide = useWide();
  const feed = useQuery({ queryKey: ['feed'], queryFn: api.feed, refetchInterval: 15_000 });

  // Items with a reaction in flight (or queued offline) leave the stack at once; a successful
  // reaction keeps its item hidden until a feed poll newer than the reaction arrives.
  const reactions = useMutationState({
    filters: { predicate: (m) => (REACTIONS as readonly unknown[]).includes(m.options.mutationKey?.[0]) },
    select: (m) => ({
      vars: m.state.variables as ApproveVars | undefined,
      status: m.state.status,
      submittedAt: m.state.submittedAt,
    }),
  });
  const view = useMemo<FeedResponse | undefined>(() => {
    const hidden = reactions
      .filter((r) => r.vars && (r.status === 'pending' || (r.status === 'success' && r.submittedAt >= feed.dataUpdatedAt)))
      .map((r) => r.vars as ApproveVars);
    const seen = new Set<string>();
    return hidden.reduce((f, v) => {
      if (!f || seen.has(entityKey(v))) return f;
      seen.add(entityKey(v));
      return withoutItem(f, v);
    }, feed.data);
  }, [feed.data, feed.dataUpdatedAt, reactions]);
  // The card on top stays there while the feed is in front, until the user reacts to it: a card that comes in ranked
  // above it comes next, so a swipe never lands on a card that slid in under the finger. A card back from a refused
  // reaction keeps its place. Back on the feed, or with the Feed tab pressed again, the top-ranked card is first.
  const held = useRef<{ key: string; known: Set<string> } | null>(null);
  const [visit, setVisit] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setVisit((v) => v + 1);
      return () => {
        held.current = null;
      };
    }, []),
  );
  const navigation = useNavigation();
  useEffect(
    () =>
      navigation.addListener('tabPress' as never, () => {
        held.current = null;
        setVisit((v) => v + 1);
      }),
    [navigation],
  );
  const items = useMemo(() => {
    const all = view?.items ?? [];
    const h = held.current;
    const at = h ? all.findIndex((i) => entityKey(i) === h.key) : -1;
    if (!h || at <= 0) return all;
    const arrived = new Set(all.slice(0, at).filter((i) => !h.known.has(entityKey(i))));
    if (!arrived.size) return all;
    const rest = all.filter((i) => !arrived.has(i));
    const after = rest.indexOf(all[at]!) + 1;
    return [...rest.slice(0, after), ...arrived, ...rest.slice(after)];
  }, [view, visit]);

  const top = items[0];
  const topKey = top ? entityKey(top) : null;
  // Fetched since the feed opened; the feed restored from the device's cache keeps the time it was fetched then
  const opened = useRef(Date.now());
  const fresh = feed.dataUpdatedAt >= opened.current;
  useEffect(() => {
    // What the feed held when this card came on top, those with a reaction in flight included. A card from the feed
    // kept since the app was last open is not held: the feed fetched now may rank another first.
    held.current = topKey && fresh ? { key: topKey, known: new Set((feed.data?.items ?? []).map(entityKey)) } : null;
  }, [topKey, fresh]);
  const workspaces = useWorkspaces();
  const included = (workspaces.data ?? []).some((w) => w.enabled);

  return (
    <CardScreen
      item={top}
      head={view ? <Counters counts={view.counts} wide={wide} /> : null}
      behind={
        <>
          {wide && items.length > 2 ? (
            <View
              style={[
                cardFrame(wide),
                cardSkin(wide),
                // Scaled from its top edge, so that edge shows above the card in front
                { backgroundColor: C.behind2, transformOrigin: 'top', transform: [{ translateY: -20 }, { scale: 0.93 }] },
              ]}
            />
          ) : null}
          {wide && items.length > 1 ? (
            <View
              style={[
                cardFrame(wide),
                cardSkin(wide),
                { backgroundColor: C.behind1, transformOrigin: 'top', transform: [{ translateY: -10 }, { scale: 0.965 }] },
              ]}
            />
          ) : null}
        </>
      }
      empty={view && workspaces.data ? <Empty included={included} /> : null}
    />
  );
}
