import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, TextInput, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useMutation, useMutationState, useQuery } from '@tanstack/react-query';
import type { FeedCounts, FeedItem, FeedResponse, Sync, Verification } from '@momentum/contract';
import { api } from '../../lib/api';
import { REACTIONS, type ApproveVars, type ResolveVars, type SendBackVars } from '../../lib/query';
import { withoutItem } from '../../lib/feed';
import { entityKey } from '../../lib/format';
import { C, F, useTheme, useWide } from '../../ui/theme';
import { H, T } from '../../ui/Text';
import { CardView } from '../../ui/CardView';
import { IssueHead, IssueOptions } from '../../ui/IssueOptions';
import { Btn } from '../../ui/parts';
import { STATE_LABEL, StateIcon, Tip, type State } from '../../ui/StateBadge';
import { useCornerRoom } from '../../ui/SettingsButton';
import { useWorkspaces } from '../../lib/workspace';
import { router } from 'expo-router';

const THRESHOLD = 110;
const FLING = 800;

function cardFrame(wide: boolean): ViewStyle {
  return wide
    ? { position: 'absolute', left: '50%', marginLeft: -280, width: 560, top: 40, bottom: 40 }
    : { position: 'absolute', left: 16, right: 16, top: 14, bottom: 12 };
}

/** Read while rendering, as every colour is: a constant would keep the scheme the module was loaded in */
function cardSkin(): ViewStyle {
  return {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 18,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
    overflow: 'hidden',
  };
}

const VERIFICATION: Verification[] = ['unverified', 'verified'];
const SYNC: Sync[] = ['synced', 'entity_ahead', 'artifact_ahead', 'updating'];

/** Entities of the enabled projects by state, verification and sync in one segment each; each state is named on hover or long-press. */
function Counters({ counts, wide }: { counts: FeedCounts; wide: boolean }) {
  const corner = useCornerRoom();
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
          : { paddingLeft: 16, paddingRight: 16 + corner, paddingTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }
      }
    >
      {segment(VERIFICATION.map((v) => [v, counts.verification[v]]))}
      {segment(SYNC.map((v) => [v, counts.sync[v]]))}
    </View>
  );
}

function Stamp({ kind, label }: { kind: 'ok' | 'no'; label: string }) {
  const colour = kind === 'ok' ? C.ok : C.no;
  return (
    <View
      style={{
        borderWidth: 3,
        borderColor: colour,
        borderRadius: 6,
        backgroundColor: C.surface,
        paddingVertical: 8,
        paddingHorizontal: 16,
        transform: [{ rotate: kind === 'ok' ? '-6deg' : '6deg' }],
      }}
    >
      <T style={{ color: colour, fontWeight: '700', letterSpacing: 3, fontSize: 15 }}>
        {label}
      </T>
    </View>
  );
}

function TopCard({
  item,
  wide,
  wash,
  sheetOpen,
  onApprove,
  onResolve,
  onDisapprove,
}: {
  item: FeedItem;
  wide: boolean;
  wash: SharedValue<number>;
  sheetOpen: boolean;
  onApprove: () => void;
  onResolve: (option: number) => void;
  onDisapprove: () => void;
}) {
  const { width } = useWindowDimensions();
  const tx = useSharedValue(0);
  const hold = useSharedValue(0);
  // An issue with options resolves with the picked one; the recommended one starts picked
  const issue = item.issue;
  const [picked, setPicked] = useState<number | null>(issue?.recommended ?? null);
  const canSwipeRight = useSharedValue(issue && picked === null ? 0 : 1);
  useEffect(() => {
    canSwipeRight.value = issue && picked === null ? 0 : 1;
  }, [issue, picked, canSwipeRight]);
  const right = () => (issue && picked !== null ? onResolve(picked) : onApprove());

  useEffect(() => {
    if (!sheetOpen && hold.value) {
      hold.value = 0;
      tx.value = withSpring(0);
      wash.value = withTiming(0);
    }
  }, [sheetOpen, hold, tx, wash]);

  const pan = Gesture.Pan()
    .enabled(!sheetOpen)
    .activeOffsetX([-10, 10])
    .onUpdate((e) => {
      tx.value = e.translationX;
      wash.value = e.translationX;
    })
    .onEnd((e) => {
      if (canSwipeRight.value && (e.translationX > THRESHOLD || e.velocityX > FLING)) {
        wash.value = withTiming(0, { duration: 400 });
        tx.value = withTiming(width * 1.2, { duration: 220 }, (finished) => {
          if (finished) scheduleOnRN(right);
        });
      } else if (e.translationX < -THRESHOLD || e.velocityX < -FLING) {
        hold.value = 1;
        wash.value = -THRESHOLD;
        tx.value = withSpring(-14);
        scheduleOnRN(onDisapprove);
      } else {
        tx.value = withSpring(0);
        wash.value = withTiming(0);
      }
    });

  const moving = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { rotate: `${Math.max(-10, Math.min(10, tx.value * 0.1))}deg` }],
  }));
  const okStamp = useAnimatedStyle(() => ({ opacity: interpolate(tx.value, [0, 80], [0, 1], 'clamp') }));
  const noStamp = useAnimatedStyle(() => ({
    opacity: Math.max(hold.value, interpolate(tx.value, [-80, 0], [1, 0], 'clamp')),
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[cardFrame(wide), cardSkin(), { boxShadow: '0 2px 8px rgba(30,41,59,.14)' }, moving]}
      >
        <CardView type={item.type} workspace={item.workspace} path={item.path} title={item.title} card={item.card} diff={item.diff} swipe />
        {issue ? (
          <>
            <IssueHead issue={issue} workspace={item.workspace} />
            <IssueOptions issue={issue} picked={picked} onPick={setPicked} />
          </>
        ) : null}
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', right: 22, top: issue ? 150 : 210 }, okStamp]}>
          <Stamp kind="ok" label={issue ? 'RESOLVE' : 'APPROVE'} />
        </Animated.View>
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', right: 18, top: issue ? 150 : 330 }, noStamp]}>
          <Stamp kind="no" label={issue ? 'OTHER' : 'DISAPPROVE'} />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

/** Disapprove with a comment; for an issue, the user's own resolution or the reason it won't be resolved */
function Sheet({
  wide,
  issue,
  onCancel,
  onSend,
  onWontResolve,
}: {
  wide: boolean;
  issue: boolean;
  onCancel: () => void;
  onSend: (comment: string) => void;
  onWontResolve: (reason: string) => void;
}) {
  const [comment, setComment] = useState('');
  return (
    <>
      <Pressable
        onPress={onCancel}
        accessibilityLabel="Cancel"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.dim }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={
          wide
            ? { position: 'absolute', left: '50%', marginLeft: -280, width: 560, bottom: 40 }
            : { position: 'absolute', left: 0, right: 0, bottom: 0 }
        }
      >
        <View
          style={{
            backgroundColor: C.surface,
            borderRadius: wide ? 18 : undefined,
            borderTopLeftRadius: wide ? 18 : 26,
            borderTopRightRadius: wide ? 18 : 26,
            paddingTop: 12,
            paddingHorizontal: 18,
            paddingBottom: 22,
            boxShadow: '0 -4px 14px rgba(30,41,59,.2)',
          }}
        >
          <View
            style={{
              width: 44,
              height: 5,
              borderRadius: 3,
              backgroundColor: C.line,
              alignSelf: 'center',
              marginBottom: 14,
            }}
          />
          <H style={{ fontSize: 22, marginBottom: 12 }}>{issue ? 'Your resolution' : 'Disapprove'}</H>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder={issue ? 'How should it be resolved, or why not?' : 'What should change?'}
            placeholderTextColor={C.muted}
            multiline
            autoFocus
            style={[
              {
                borderWidth: 1.5,
                borderColor: C.accent,
                borderRadius: 12,
                backgroundColor: C.commentBg,
                paddingVertical: 12,
                paddingHorizontal: 14,
                fontSize: 14.5,
                lineHeight: 20,
                minHeight: 88,
                marginBottom: 14,
                color: C.ink,
                fontFamily: F.body,
                textAlignVertical: 'top',
              },
              Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
            ]}
          />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {issue ? (
              <Btn
                label="Won't resolve"
                kind="ghost"
                disabled={!comment.trim()}
                onPress={() => onWontResolve(comment.trim())}
                style={{ flex: 1 }}
              />
            ) : (
              <Btn label="Cancel" kind="ghost" onPress={onCancel} style={{ flex: 1 }} />
            )}
            <Btn
              label={issue ? 'Send' : 'Send back'}
              kind="primary"
              disabled={!comment.trim()}
              onPress={() => onSend(comment.trim())}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </>
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
  const approve = useMutation<void, Error, ApproveVars>({ mutationKey: ['approve'] });
  const sendBack = useMutation<{ runId: string }, Error, SendBackVars>({ mutationKey: ['sendBack'] });
  const resolve = useMutation<{ runId: string }, Error, ResolveVars>({ mutationKey: ['resolve'] });
  const wontResolve = useMutation<void, Error, SendBackVars>({ mutationKey: ['wontResolve'] });

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
  // The card on top stays there until the user reacts to it: an item a poll ranks above it comes next, so a swipe
  // never lands on a card that slid in under the finger
  const held = useRef<string | null>(null);
  const items = useMemo(() => {
    const all = view?.items ?? [];
    const at = held.current ? all.findIndex((i) => entityKey(i) === held.current) : -1;
    return at > 0 ? [all[at]!, ...all.slice(0, at), ...all.slice(at + 1)] : all;
  }, [view]);

  const top = items[0];
  const topKey = top ? entityKey(top) : null;
  const topSince = useRef(Date.now());
  useEffect(() => {
    topSince.current = Date.now();
    held.current = topKey;
  }, [topKey]);
  const workspaces = useWorkspaces();
  const included = (workspaces.data ?? []).some((w) => w.enabled);

  const [sheetFor, setSheetFor] = useState<{ item: FeedItem } | null>(null);
  const wash = useSharedValue(0);
  // Plain values for the worklet, which cannot follow the palette; the deps redraw it when the scheme changes.
  const washes = [C.washNo, C.screen, C.washOk];
  const washStyle = useAnimatedStyle(
    () => ({ backgroundColor: interpolateColor(wash.value, [-80, 0, 80], washes) }),
    washes,
  );

  const spent = () => Math.max(0, Math.round(Date.now() - topSince.current));

  return (
    <Animated.View style={[{ flex: 1 }, washStyle]}>
      {view ? <Counters counts={view.counts} wide={wide} /> : null}
      <View style={{ flex: 1 }}>
        {items.length > 2 ? (
          <View
            style={[
              cardFrame(wide),
              cardSkin(),
              // Scaled from its top edge, so that edge shows above the card in front
              { backgroundColor: C.behind2, transformOrigin: 'top', transform: [{ translateY: wide ? -20 : -16 }, { scale: 0.93 }] },
            ]}
          />
        ) : null}
        {items.length > 1 ? (
          <View
            style={[
              cardFrame(wide),
              cardSkin(),
              { backgroundColor: C.behind1, transformOrigin: 'top', transform: [{ translateY: wide ? -10 : -8 }, { scale: 0.965 }] },
            ]}
          />
        ) : null}
        {top ? (
          <TopCard
            key={topKey}
            item={top}
            wide={wide}
            wash={wash}
            sheetOpen={!!sheetFor}
            onApprove={() => {
              approve.mutate({ workspace: top.workspace, path: top.path, timeSpentMs: spent(), version: top.version });
            }}
            onResolve={(option) => {
              resolve.mutate({ workspace: top.workspace, path: top.path, option, timeSpentMs: spent(), version: top.version });
            }}
            onDisapprove={() => setSheetFor({ item: top })}
          />
        ) : null}
        {view && !top && workspaces.data ? <Empty included={included} /> : null}
      </View>
      {sheetFor ? (
        <Sheet
          wide={wide}
          issue={!!sheetFor.item.issue}
          onCancel={() => setSheetFor(null)}
          onSend={(comment) => {
            const { item } = sheetFor;
            const vars = { workspace: item.workspace, path: item.path, comment, timeSpentMs: spent() };
            if (item.issue) resolve.mutate(vars);
            else sendBack.mutate(vars);
            wash.value = withTiming(0);
            setSheetFor(null);
          }}
          onWontResolve={(comment) => {
            const { item } = sheetFor;
            wontResolve.mutate({ workspace: item.workspace, path: item.path, comment, timeSpentMs: spent() });
            wash.value = withTiming(0);
            setSheetFor(null);
          }}
        />
      ) : null}
    </Animated.View>
  );
}
