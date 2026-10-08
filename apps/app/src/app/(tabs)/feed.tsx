import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View, useWindowDimensions, type ViewStyle } from 'react-native';
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
import { useMutation, useMutationState, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ContextItem, FeedCounts, FeedItem, FeedResponse, Sync, Verification } from '@momentum/contract';
import { api } from '../../lib/api';
import { chatContext, useChatContext } from '../../lib/context';
import { REACTIONS, type ApproveVars, type ResolveVars, type SendBackVars } from '../../lib/query';
import { withoutItem } from '../../lib/feed';
import { entityKey } from '../../lib/format';
import { C, F, useTheme, useWide } from '../../ui/theme';
import { H, T } from '../../ui/Text';
import { CardView } from '../../ui/CardView';
import { Composer } from '../../ui/Composer';
import { Conversation } from '../../ui/Conversation';
import { IssueHead, IssueOptions } from '../../ui/IssueOptions';
import { Btn, useCloseOnBack } from '../../ui/parts';
import { STATE_LABEL, StateIcon, Tip, type State } from '../../ui/StateBadge';
import { useCornerRoom } from '../../ui/SettingsButton';
import { useWorkspaces } from '../../lib/workspace';
import { router, useFocusEffect, useNavigation } from 'expo-router';

const THRESHOLD = 110;
const FLING = 800;
/** How far a card is pulled up to open the chat on it */
const UP = 70;

/** With the chat on the card open, the card leaves room below it for the chat */
function cardFrame(wide: boolean, chat = false): ViewStyle {
  return wide
    ? { position: 'absolute', left: '50%', marginLeft: -280, width: 560, top: 40, bottom: chat ? 12 : 40 }
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

function Stamp({ kind, label }: { kind: 'ok' | 'no' | 'ask'; label: string }) {
  const colour = kind === 'ok' ? C.ok : kind === 'no' ? C.no : C.accent;
  return (
    <View
      style={{
        borderWidth: 3,
        borderColor: colour,
        borderRadius: 6,
        backgroundColor: C.surface,
        paddingVertical: 8,
        paddingHorizontal: 16,
        transform: [{ rotate: kind === 'ok' ? '-6deg' : kind === 'no' ? '6deg' : '0deg' }],
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
  chatOpen,
  onApprove,
  onResolve,
  onDisapprove,
  onChat,
}: {
  item: FeedItem;
  wide: boolean;
  wash: SharedValue<number>;
  sheetOpen: boolean;
  chatOpen: boolean;
  onApprove: () => void;
  onResolve: (option: number) => void;
  onDisapprove: () => void;
  onChat: () => void;
}) {
  const { width } = useWindowDimensions();
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const hold = useSharedValue(0);
  // A card scrolled to its end, or short enough not to scroll, has nothing left to scroll up: pulled up, it opens the chat
  const scroll = useRef({ y: 0, view: 0, content: 0 });
  const [atEnd, setAtEnd] = useState(true);
  const measure = () => {
    const s = scroll.current;
    setAtEnd(s.y + s.view >= s.content - 2);
  };
  const canPullUp = atEnd && !chatOpen;
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

  const base = Gesture.Pan().enabled(!sheetOpen).activeOffsetX([-10, 10]);
  // A finger moving up or down scrolls a card longer than the screen; at its end, moving up pulls the card up instead
  const pan = (canPullUp ? base.activeOffsetY(-10).failOffsetY(12) : base.failOffsetY([-12, 12]))
    .onUpdate((e) => {
      // Pulled up, the card follows the finger halfway and stays where it is sideways
      if (canPullUp && e.translationY < 0 && -e.translationY > Math.abs(e.translationX)) {
        ty.value = e.translationY / 2;
        tx.value = 0;
        wash.value = 0;
        return;
      }
      ty.value = 0;
      tx.value = e.translationX;
      wash.value = e.translationX;
    })
    .onEnd((e) => {
      if (ty.value < 0) {
        ty.value = withSpring(0);
        if (-e.translationY > UP || e.velocityY < -FLING) scheduleOnRN(onChat);
      } else if (canSwipeRight.value && (e.translationX > THRESHOLD || e.velocityX > FLING)) {
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
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotate: `${Math.max(-10, Math.min(10, tx.value * 0.1))}deg` },
    ],
  }));
  const askStamp = useAnimatedStyle(() => ({ opacity: interpolate(ty.value, [-UP / 2, -8], [1, 0], 'clamp') }));
  const okStamp = useAnimatedStyle(() => ({ opacity: interpolate(tx.value, [0, 80], [0, 1], 'clamp') }));
  const noStamp = useAnimatedStyle(() => ({
    opacity: Math.max(hold.value, interpolate(tx.value, [-80, 0], [1, 0], 'clamp')),
  }));

  return (
    // At its end the browser keeps only the finger moving down, which scrolls back up; where pan-up is unknown, pan-y stays
    <GestureDetector gesture={pan} touchAction={canPullUp ? 'pan-up' : 'pan-y'}>
      <Animated.View
        style={[cardFrame(wide, chatOpen), cardSkin(), { paddingTop: 0, paddingBottom: 0, paddingHorizontal: 0, boxShadow: '0 2px 8px rgba(30,41,59,.14)' }, moving]}
      >
        {/* A card longer than the screen scrolls within it: nothing of it, an issue's options included, is out of reach */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: 20, paddingHorizontal: 20, paddingBottom: 16 }}
          scrollEventThrottle={32}
          onScroll={(e) => {
            scroll.current.y = e.nativeEvent.contentOffset.y;
            measure();
          }}
          onLayout={(e) => {
            scroll.current.view = e.nativeEvent.layout.height;
            measure();
          }}
          onContentSizeChange={(_w, h) => {
            scroll.current.content = h;
            measure();
          }}
        >
          <CardView type={item.type} workspace={item.workspace} path={item.path} title={item.title} card={item.card} diff={item.diff} swipe />
          {issue ? (
            <>
              <IssueHead issue={issue} workspace={item.workspace} />
              <IssueOptions issue={issue} picked={picked} onPick={setPicked} />
            </>
          ) : null}
        </ScrollView>
        {/* Each stamp sits on the edge the card trails, so it stays on screen as the card leaves */}
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 22, top: issue ? 150 : 210 }, okStamp]}>
          <Stamp kind="ok" label={issue ? 'RESOLVE' : 'APPROVE'} />
        </Animated.View>
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', right: 18, top: issue ? 150 : 330 }, noStamp]}>
          <Stamp kind="no" label={issue ? 'OTHER' : 'REWORK'} />
        </Animated.View>
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, right: 0, bottom: 28, alignItems: 'center' }, askStamp]}>
          <Stamp kind="ask" label="ASK" />
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
  useCloseOnBack(true, onCancel);
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
          <H style={{ fontSize: 22, marginBottom: 12 }}>{issue ? 'Your resolution' : 'Rework'}</H>
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

/** The whole card, as the chat on it takes it into its context */
function wholeCard(item: FeedItem): ContextItem {
  return { workspace: item.workspace, path: item.path, title: item.title, heading: [] };
}

/**
 * The chat on the card on top, below it: the composer with the whole card in its context, then the conversation the
 * first message starts, on the card as its target. Parts of the card selected meanwhile join the context.
 */
function CardChat({
  item,
  runId,
  wide,
  onStarted,
  onClose,
}: {
  item: FeedItem;
  runId: string | null;
  wide: boolean;
  onStarted: (runId: string) => void;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { height } = useWindowDimensions();
  const context = useChatContext(item.workspace);
  useCloseOnBack(true, onClose);
  return (
    <View
      style={[
        wide ? { alignSelf: 'center', width: 560, marginBottom: 40 } : { marginHorizontal: 16, marginBottom: 12 },
        cardSkin(),
        { paddingTop: 10, paddingBottom: 14, paddingHorizontal: 14, gap: 8 },
        runId ? { height: Math.round(height * (wide ? 0.4 : 0.45)) } : null,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <T numberOfLines={1} style={{ flex: 1, fontSize: 13, fontWeight: '700', color: C.muted }}>
          Chat on this card
        </T>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close chat" hitSlop={10}>
          <T style={{ fontSize: 20, lineHeight: 22, color: C.muted, fontFamily: F.body }}>×</T>
        </Pressable>
      </View>
      {runId ? (
        <Conversation key={runId} runId={runId} compact />
      ) : (
        <Composer
          placeholder="Ask about this card"
          autoFocus
          context={context}
          onSend={async (text) => {
            const { runId: started } = await api.createChat(item.workspace, { text, targetPath: item.path, context });
            chatContext.clear(item.workspace);
            void qc.invalidateQueries({ queryKey: ['chats', item.workspace] });
            onStarted(started);
          }}
        />
      )}
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
  const topSince = useRef(Date.now());
  // Fetched since the feed opened; the feed restored from the device's cache keeps the time it was fetched then
  const opened = useRef(Date.now());
  const fresh = feed.dataUpdatedAt >= opened.current;
  useEffect(() => {
    topSince.current = Date.now();
    // What the feed held when this card came on top, those with a reaction in flight included. A card from the feed
    // kept since the app was last open is not held: the feed fetched now may rank another first.
    held.current = topKey && fresh ? { key: topKey, known: new Set((feed.data?.items ?? []).map(entityKey)) } : null;
  }, [topKey, fresh]);
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

  // The chat on the top card, opened by pulling the card up. It closes with the card: once the card is reacted to, or
  // changes, as when the chat reworked it, there is a new card to look at. Its run is kept to open again on the same card.
  const [chat, setChat] = useState<{ item: FeedItem; runId: string | null } | null>(null);
  const chats = useRef(new Map<string, string>());
  const closeChat = useCallback(() => {
    // The card waiting in the context was never sent: it goes with the chat
    if (chat && !chat.runId) chatContext.remove(wholeCard(chat.item));
    setChat(null);
  }, [chat]);
  useEffect(() => {
    if (chat && (topKey !== entityKey(chat.item) || top?.version !== chat.item.version)) closeChat();
  }, [chat, topKey, top?.version, closeChat]);

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
            chatOpen={!!chat}
            onChat={() => {
              const runId = chats.current.get(topKey!) ?? null;
              if (!runId) chatContext.add(wholeCard(top));
              setChat({ item: top, runId });
            }}
          />
        ) : null}
        {view && !top && workspaces.data ? <Empty included={included} /> : null}
      </View>
      {chat ? (
        <CardChat
          item={chat.item}
          runId={chat.runId}
          wide={wide}
          onStarted={(runId) => {
            chats.current.set(entityKey(chat.item), runId);
            setChat({ item: chat.item, runId });
          }}
          onClose={closeChat}
        />
      ) : null}
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
