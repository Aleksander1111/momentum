import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
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
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ContextItem, FeedItem } from '@momentum/contract';
import { api } from '../lib/api';
import { chatContext, useChatContext } from '../lib/context';
import { attachmentIds, chatFiles, useChatFiles } from '../lib/attachments';
import type { ApproveVars, ResolveVars, SendBackVars } from '../lib/query';
import { entityKey } from '../lib/format';
import { C, F, useWide } from './theme';
import { H, T } from './Text';
import { CardView } from './CardView';
import { Composer } from './Composer';
import { Conversation } from './Conversation';
import { IssueHead, IssueOptions } from './IssueOptions';
import { Btn, useCloseOnBack } from './parts';

/** A card to react to, as the feed brings it or as it is opened from anywhere else */
export type ReviewItem = Pick<FeedItem, 'workspace' | 'path' | 'type' | 'title' | 'card' | 'diff' | 'version' | 'issue'>;

const THRESHOLD = 110;
const FLING = 800;
/** How far a card is pulled up to open the chat on it */
const UP = 70;

/** Wide, the card and what goes with it keep to one column, centred in the room they have, narrower where it is less */
const COLUMN: ViewStyle = { alignSelf: 'center', width: '100%', maxWidth: 560 };
/** The column, held off the edges, laid over the room it centres in */
const OVER: ViewStyle = { position: 'absolute', left: 20, right: 20, marginHorizontal: 'auto', maxWidth: 560 };

/**
 * With the chat on the card open, the card leaves room below it for the chat; above it, room for the cards behind.
 * On a phone the card takes the whole screen below the counters, with nothing behind it. Once the chat has messages,
 * the card is the top of one page with the conversation (`flow`): it takes the height of its content.
 */
export function cardFrame(wide: boolean, chat = false, flow = false): ViewStyle {
  if (flow) return wide ? { ...COLUMN, marginTop: 16 } : {};
  return wide
    ? { ...OVER, top: 40, bottom: chat ? 12 : 40 }
    : { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 };
}

/**
 * Read while rendering, as every colour is: a constant would keep the scheme the module was loaded in. On a phone the
 * card has no frame: it is the screen, until a swipe lifts it (see TopCard).
 */
export function cardSkin(wide: boolean): ViewStyle {
  return {
    ...(wide ? { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 18 } : null),
    paddingTop: 20,
    paddingHorizontal: wide ? 20 : 16,
    paddingBottom: 16,
    overflow: 'hidden',
  };
}

/** How far a card moves before it shows as a card in full, lifted off the screen */
const LIFT = 40;

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
  flow,
  picked,
  aside,
  below,
  onPickOption,
  onApprove,
  onResolve,
  onDisapprove,
  onChat,
  onPick,
}: {
  item: ReviewItem;
  wide: boolean;
  wash: SharedValue<number>;
  sheetOpen: boolean;
  chatOpen: boolean;
  /** The top of one page with the chat's conversation, scrolled with it */
  flow: boolean;
  /** The option of an issue picked to resolve it with: kept by the feed, as the card moves onto the chat's page */
  picked: number | null;
  aside?: ReactNode;
  below?: ReactNode;
  onPickOption: (option: number) => void;
  onApprove: () => void;
  onResolve: (option: number) => void;
  onDisapprove: () => void;
  onChat: () => void;
  onPick: (item: ContextItem) => void;
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
  // An issue with options resolves with the picked one
  const issue = item.issue;
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
  // On a phone the card at rest is the screen; moved, it takes on its edge, corners and shadow. Plain values for the
  // worklet, as for the wash.
  const looks = [C.screen, C.surface, C.line];
  const lifted = useAnimatedStyle(() => {
    if (wide) return {};
    const p = Math.max(hold.value, interpolate(Math.max(Math.abs(tx.value), -ty.value * 2), [0, LIFT], [0, 1], 'clamp'));
    return {
      backgroundColor: interpolateColor(p, [0, 1], [looks[0]!, looks[1]!]),
      borderColor: interpolateColor(p, [0, 1], [looks[0]!, looks[2]!]),
      borderWidth: 1,
      borderRadius: 18 * p,
      boxShadow: `0 2px 8px rgba(30,41,59,${(0.14 * p).toFixed(3)})`,
    };
  }, [wide, ...looks]);

  return (
    // At its end the browser keeps only the finger moving down, which scrolls back up; where pan-up is unknown, pan-y stays
    <GestureDetector gesture={pan} touchAction={canPullUp ? 'pan-up' : 'pan-y'}>
      <Animated.View
        style={[
          cardFrame(wide, chatOpen, flow),
          cardSkin(wide),
          { paddingTop: 0, paddingBottom: 0, paddingHorizontal: 0 },
          wide ? { boxShadow: '0 2px 8px rgba(30,41,59,.14)' } : null,
          lifted,
          moving,
        ]}
      >
        {/* A card longer than the screen scrolls within it: nothing of it, an issue's options included, is out of reach.
            On the chat's page it is as long as its content, and the page scrolls. */}
        <ScrollView
          style={flow ? undefined : { flex: 1 }}
          scrollEnabled={!flow}
          contentContainerStyle={{ paddingTop: wide ? 20 : 12, paddingHorizontal: wide ? 20 : 16, paddingBottom: 16 }}
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
          <CardView type={item.type} workspace={item.workspace} path={item.path} title={item.title} card={item.card} diff={item.diff} aside={aside} swipe onPick={onPick} />
          {issue ? (
            <>
              <IssueHead issue={issue} workspace={item.workspace} />
              <IssueOptions issue={issue} picked={picked} onPick={onPickOption} />
            </>
          ) : null}
          {below}
        </ScrollView>
        {/* A card that goes on below fades out at its bottom edge, so it reads as one to scroll, not one cut off */}
        {atEnd || flow ? null : <Fade colour={wide ? C.surface : C.screen} />}
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

function Fade({ colour }: { colour: string }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 48 }}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colour} stopOpacity={0} />
            <Stop offset="1" stopColor={colour} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#fade)" />
      </Svg>
    </View>
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
            ? { ...OVER, bottom: 40 }
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
function wholeCard(item: ReviewItem): ContextItem {
  return { workspace: item.workspace, path: item.path, title: item.title, heading: [] };
}

function ChatHead({ onClose }: { onClose: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <T numberOfLines={1} style={{ flex: 1, fontSize: 13, fontWeight: '700', color: C.muted }}>
        Chat on this card
      </T>
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close chat" hitSlop={10}>
        <T style={{ fontSize: 20, lineHeight: 22, color: C.muted, fontFamily: F.body }}>×</T>
      </Pressable>
    </View>
  );
}

/**
 * The chat on the card on top, below it: the composer with the whole card in its context, then the conversation the
 * first message starts, on the card as its target. Parts of the card selected, which open it too, join the context.
 * Once started, the card and the conversation are one page that scrolls as a whole, the composer at its foot.
 */
function CardChat({
  item,
  runId,
  wide,
  card,
  onStarted,
  onClose,
}: {
  item: ReviewItem;
  runId: string | null;
  wide: boolean;
  /** The card on top, at the top of the page once the conversation started */
  card: ReactNode;
  onStarted: (runId: string) => void;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const context = useChatContext(item.workspace);
  const files = attachmentIds(useChatFiles(item.workspace));
  useCloseOnBack(true, onClose);
  // A part of the card selected while the chat is open is asked about next: the field takes the keys
  const field = useRef<TextInput>(null);
  const parts = useRef(context.length);
  useEffect(() => {
    if (context.length > parts.current) field.current?.focus();
    parts.current = context.length;
  }, [context.length]);
  if (runId) {
    const column: ViewStyle = wide ? COLUMN : { paddingHorizontal: 16 };
    return (
      <Conversation
        key={runId}
        runId={runId}
        column={column}
        above={
          <>
            {card}
            <View style={[column, { paddingTop: 6 }]}>
              <ChatHead onClose={onClose} />
            </View>
          </>
        }
      />
    );
  }
  return (
    <View
      style={[
        wide ? { ...COLUMN, marginBottom: 40 } : { borderTopWidth: 1, borderTopColor: C.line },
        cardSkin(wide),
        { paddingTop: 10, paddingBottom: 14, paddingHorizontal: wide ? 14 : 16, gap: 8 },
      ]}
    >
      <ChatHead onClose={onClose} />
      <Composer
        ref={field}
        placeholder="Ask about this card"
        autoFocus
        context={context}
        attachTo={item.workspace}
        onSend={async (text) => {
          const { runId: started } = await api.createChat(item.workspace, { text, targetPath: item.path, context, attachments: files });
          chatContext.clear(item.workspace);
          chatFiles.clear(item.workspace);
          void qc.invalidateQueries({ queryKey: ['chats', item.workspace] });
          onStarted(started);
        }}
      />
    </View>
  );
}


/**
 * One card to react to, however it was reached: swiped right it approves, or resolves an issue with the option picked;
 * left it asks for rework with a comment; pulled up at its end it opens the chat on it. `head` sits above it, such as
 * the feed's counters or a way back; `behind`, the cards under it; `empty`, what shows without one. `aside` goes beside
 * the card's states, `below` under its content. `onReacted` follows each reaction sent.
 */
export function CardScreen({
  item,
  head,
  behind,
  empty,
  aside,
  below,
  onReacted,
}: {
  item: ReviewItem | null | undefined;
  head?: ReactNode;
  behind?: ReactNode;
  empty?: ReactNode;
  aside?: ReactNode;
  below?: ReactNode;
  onReacted?: () => void;
}) {
  const wide = useWide();
  const approve = useMutation<void, Error, ApproveVars>({ mutationKey: ['approve'] });
  const sendBack = useMutation<{ runId: string }, Error, SendBackVars>({ mutationKey: ['sendBack'] });
  const resolve = useMutation<{ runId: string }, Error, ResolveVars>({ mutationKey: ['resolve'] });
  const wontResolve = useMutation<void, Error, SendBackVars>({ mutationKey: ['wontResolve'] });

  const key = item ? entityKey(item) : null;
  const since = useRef(Date.now());
  useEffect(() => {
    since.current = Date.now();
  }, [key]);
  const spent = () => Math.max(0, Math.round(Date.now() - since.current));

  const [sheetFor, setSheetFor] = useState<{ item: ReviewItem } | null>(null);
  const wash = useSharedValue(0);
  // Plain values for the worklet, which cannot follow the palette; the deps redraw it when the scheme changes.
  const washes = [C.washNo, C.screen, C.washOk];
  const washStyle = useAnimatedStyle(
    () => ({ backgroundColor: interpolateColor(wash.value, [-80, 0, 80], washes) }),
    washes,
  );

  // The chat on the card, opened by pulling the card up. It closes with the card: once the card is reacted to, or
  // changes, as when the chat reworked it, there is a new card to look at. Its run is kept to open again on the same card.
  const [chat, setChat] = useState<{ item: ReviewItem; runId: string | null } | null>(null);
  const chats = useRef(new Map<string, string>());
  const closeChat = useCallback(() => {
    // What of the card waits in the context, the whole card or parts selected, was never sent: it goes with the chat
    if (chat) for (const c of chatContext.of(chat.item.workspace)) if (c.path === chat.item.path) chatContext.remove(c);
    setChat(null);
  }, [chat]);
  useEffect(() => {
    if (chat && (key !== entityKey(chat.item) || item?.version !== chat.item.version)) closeChat();
  }, [chat, key, item?.version, closeChat]);

  // The option picked on the card; the recommended one until the user picks another
  const [pick, setPick] = useState<{ key: string; option: number } | null>(null);
  const picked = pick && pick.key === key ? pick.option : (item?.issue?.recommended ?? null);
  // Once the chat on the card has a conversation, the card is the top of its page
  const flow = !!chat?.runId;

  const card = item ? (
    <TopCard
      key={key}
      item={item}
      wide={wide}
      wash={wash}
      sheetOpen={!!sheetFor}
      chatOpen={!!chat}
      flow={flow}
      picked={picked}
      aside={aside}
      below={below}
      onPickOption={(option) => setPick({ key: key!, option })}
      onApprove={() => {
        approve.mutate({ workspace: item.workspace, path: item.path, timeSpentMs: spent(), version: item.version });
        onReacted?.();
      }}
      onResolve={(option) => {
        resolve.mutate({ workspace: item.workspace, path: item.path, option, timeSpentMs: spent(), version: item.version });
        onReacted?.();
      }}
      onDisapprove={() => setSheetFor({ item })}
      onChat={() => {
        const runId = chats.current.get(key!) ?? null;
        if (!runId) chatContext.add(wholeCard(item));
        setChat({ item, runId });
      }}
      onPick={(part) => {
        // A part of the card selected opens the chat on it, with the part in its context instead of the whole card
        chatContext.add(part);
        if (!chat) setChat({ item, runId: chats.current.get(key!) ?? null });
      }}
    />
  ) : null;
  const cardChat = chat ? (
    <CardChat
      item={chat.item}
      runId={chat.runId}
      wide={wide}
      card={card}
      onStarted={(runId) => {
        chats.current.set(entityKey(chat.item), runId);
        setChat({ item: chat.item, runId });
      }}
      onClose={closeChat}
    />
  ) : null;

  return (
    <Animated.View style={[{ flex: 1 }, washStyle]}>
      {head}
      {flow ? (
        cardChat
      ) : (
        <>
        <View style={{ flex: 1 }}>
          {item ? behind : null}
          {card}
          {item ? null : empty}
        </View>
        {cardChat}
        </>
      )}
      {sheetFor ? (
        <Sheet
          wide={wide}
          issue={!!sheetFor.item.issue}
          onCancel={() => setSheetFor(null)}
          onSend={(comment) => {
            const { item: it } = sheetFor;
            const vars = { workspace: it.workspace, path: it.path, comment, timeSpentMs: spent() };
            if (it.issue) resolve.mutate(vars);
            else sendBack.mutate(vars);
            wash.value = withTiming(0);
            setSheetFor(null);
            onReacted?.();
          }}
          onWontResolve={(comment) => {
            const { item: it } = sheetFor;
            wontResolve.mutate({ workspace: it.workspace, path: it.path, comment, timeSpentMs: spent() });
            wash.value = withTiming(0);
            setSheetFor(null);
            onReacted?.();
          }}
        />
      ) : null}
    </Animated.View>
  );
}
