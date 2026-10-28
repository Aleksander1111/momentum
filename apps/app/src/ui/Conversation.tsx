import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View, type ViewStyle } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { RunDetail } from '@momentum/contract';
import { api } from '../lib/api';
import { automationLabel, duration, runStatus, usagePct } from '../lib/format';
import { C, runColour } from './theme';
import { T } from './Text';
import { hasWideBlocks, Markdown } from './Markdown';
import { Composer, ContextChip } from './Composer';
import { chatContext, useChatContext } from '../lib/context';
import { attachmentIds, chatFiles, useChatFiles } from '../lib/attachments';
import { MessageAttachment } from './Attachments';
import { Back, Btn, useFrame } from './parts';
import { EntityLinks } from './EntityRef';
import { TurnActivity } from './Activity';

const ACTIVE = new Set(['queued', 'running']);
/** How long a chat waits for the rating of its last turn's retrieval */
const RATING_WAIT_MS = 3 * 60_000;

/** Whether the run still changes: it is under way, or a turn that ended moments ago is being rated */
function changing(run: RunDetail): boolean {
  if (ACTIVE.has(run.status)) return true;
  return run.turns.some((t) => t.retrievalState === 'pending' && t.endedAt && Date.now() - new Date(t.endedAt).getTime() < RATING_WAIT_MS);
}

/** The run's automation, state and what it has used so far, after a dot in the state's colour */
function RunState({ run, stopping, size = 13.5 }: { run: RunDetail; stopping?: boolean; size?: number }) {
  // The time it has been running goes on while nothing else about the run changes
  const [, tick] = useState(0);
  useEffect(() => {
    if (run.status !== 'running') return;
    const t = setInterval(() => tick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, [run.status]);
  const running = run.status === 'running';
  const halting = !!stopping && ACTIVE.has(run.status);
  const state = halting ? 'stopping' : running && run.startedAt ? `running ${duration(run.startedAt)}` : runStatus(run.status);
  const usage = run.usage.fiveHour !== null ? ` \u00b7 ${usagePct(run.usage.fiveHour)} of 5 h` : '';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
      <View
        style={{
          width: 9,
          height: 9,
          borderRadius: 5,
          backgroundColor: halting ? C.warn : runColour(run.status),
          boxShadow: running ? `0 0 0 3px ${C.washOk}` : run.status === 'failed' ? `0 0 0 3px ${C.washNo}` : undefined,
        }}
      />
      <T style={{ fontSize: size, flexShrink: 1 }}>{`${automationLabel(run.automation)} · ${state}${usage}`}</T>
    </View>
  );
}

/** The run's state on a tile, with Stop while it is active, for a chat shown below its card */
function RunHead({ run, onStop }: { run: RunDetail; onStop: () => Promise<void> }) {
  const [stopping, setStopping] = useState(false);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: C.card,
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 14,
      }}
    >
      <View style={{ flex: 1 }}>
        <RunState run={run} stopping={stopping} />
      </View>
      {ACTIVE.has(run.status) ? (
        <Btn
          small
          kind="ghost"
          label={stopping ? 'Stopping' : 'Stop'}
          disabled={stopping}
          onPress={() => {
            setStopping(true);
            onStop().catch(() => setStopping(false));
          }}
        />
      ) : null}
    </View>
  );
}

const bubbleText = { fontSize: 14.5, lineHeight: 20 };

/** The document an interview writes, as it stands on the main line after the last answer */
function InterviewDocument({ run }: { run: RunDetail }) {
  const document = run.interview?.document;
  const frame = useFrame(12);
  const { data } = useQuery({
    queryKey: ['artifact', run.workspace, document, run.messages.length, run.status],
    queryFn: () => api.artifact(run.workspace, document as string),
    enabled: !!document,
    retry: false,
  });
  if (!data) return null;
  return (
    <View style={[frame, { paddingVertical: 10, paddingHorizontal: frame.borderWidth ? 14 : 0 }]}>
      <Markdown text={data.text} style={{ fontSize: 13.5, lineHeight: 19 }} />
    </View>
  );
}

/** What the agent did for the turns answering the user message `at`; turns of a run with no message come first */
function Turns({ run, at }: { run: RunDetail; at: number }) {
  const userSeqs = new Set(run.messages.filter((m) => m.role === 'user').map((m) => m.seq));
  const turns = run.turns.filter((t) => (at === 0 ? !userSeqs.has(t.afterSeq) : t.afterSeq === at));
  const last = run.turns[run.turns.length - 1];
  return (
    <>
      {turns.map((t) => (
        <TurnActivity key={t.turn} turn={t} live={ACTIVE.has(run.status) && t === last && !t.endedAt} />
      ))}
    </>
  );
}

/**
 * The run's state, messages and the message composer; polls the run while it is active. On its own the state is a line in
 * the top-right corner, level with `back` when there is one, and the composer's Stop ends an answer. With `above`, what
 * it shows first, the state on a tile with Stop after it, and the messages scroll as one page over the composer;
 * `column` lays out the state, messages and composer on that page.
 */
export function Conversation({
  runId,
  back,
  above,
  column,
}: {
  runId: string;
  back?: { label: string; onPress: () => void };
  above?: ReactNode;
  column?: ViewStyle;
}) {
  const qc = useQueryClient();
  const scroll = useRef<ScrollView>(null);
  // What comes in follows the end while the reader is there; scrolled up to read, the page stays where it is
  const atEnd = useRef(true);
  const { data: run } = useQuery({
    queryKey: ['run', runId],
    queryFn: () => api.run(runId),
    refetchInterval: (q) => (q.state.data && !changing(q.state.data) ? false : 2_000),
  });
  const context = useChatContext(run?.workspace ?? null);
  const interview = run?.automation === 'interview';
  const files = attachmentIds(useChatFiles(run && !interview ? run.workspace : null));

  const head =
    run && above ? (
      <RunHead
        run={run}
        onStop={async () => {
          await api.killRun(runId);
          await qc.invalidateQueries({ queryKey: ['run', runId] });
        }}
      />
    ) : null;

  return (
    // Entities the messages name open from them
    <EntityLinks workspace={run?.workspace ?? null}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      {above ? null : (
        <View style={{ flexDirection: 'row', justifyContent: back ? 'space-between' : 'flex-end', gap: 12 }}>
          {back ? <Back {...back} /> : null}
          {/* Level with Back: as tall, and centred the same */}
          <View style={{ minHeight: 34, justifyContent: 'center', alignSelf: 'flex-start', flexShrink: 1 }}>{run ? <RunState run={run} size={13} /> : null}</View>
        </View>
      )}
      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: 10, paddingVertical: 12 }}
        scrollEventThrottle={32}
        onScroll={(e) => {
          const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
          atEnd.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 40;
        }}
        onContentSizeChange={() => {
          if (atEnd.current) scroll.current?.scrollToEnd({ animated: false });
        }}
      >
        {above}
        <View style={[{ gap: 10 }, column]}>
        {above ? head : null}
        {run && interview ? <InterviewDocument run={run} /> : null}
        {run ? <Turns run={run} at={0} /> : null}
        {(run?.messages ?? []).map((m) =>
          m.role === 'user' ? (
            <Fragment key={m.seq}>
            <View
              style={{
                alignSelf: 'flex-end',
                maxWidth: '84%',
                backgroundColor: C.ink,
                borderRadius: 16,
                borderBottomRightRadius: 4,
                paddingVertical: 10,
                paddingHorizontal: 14,
              }}
            >
              {m.context.length ? (
                <View style={{ gap: 4, marginBottom: 6, alignItems: 'flex-start' }}>
                  {m.context.map((c, i) => (
                    <ContextChip key={i} item={c} inverse />
                  ))}
                </View>
              ) : null}
              {m.attachments.length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                  {m.attachments.map((a) => (
                    <MessageAttachment key={a.id} workspace={run!.workspace} attachment={a} />
                  ))}
                </View>
              ) : null}
              <T style={[bubbleText, { color: C.surface }]}>{m.text}</T>
            </View>
            <Turns run={run!} at={m.seq} />
            </Fragment>
          ) : (
            <View
              key={m.seq}
              style={{
                alignSelf: 'flex-start',
                ...(hasWideBlocks(m.text) ? { width: '100%' as const } : { maxWidth: '84%' as const }),
                backgroundColor: C.surface,
                borderWidth: 1,
                borderColor: C.line,
                borderRadius: 16,
                borderBottomLeftRadius: 4,
                paddingVertical: 10,
                paddingHorizontal: 14,
              }}
            >
              <Markdown text={m.text} style={bubbleText} />
            </View>
          ),
        )}
        </View>
      </ScrollView>
      {/* The composer: as far from the messages as from the edge below */}
      <View style={[column, { paddingVertical: 12 }]}>
      <Composer
        placeholder={interview ? 'Answer' : 'Message'}
        context={interview ? undefined : context}
        attachTo={run && !interview ? run.workspace : null}
        // While the agent is answering, stop ends its turn; the next message resumes the chat
        onStop={
          run && ACTIVE.has(run.status)
            ? async () => {
                await api.killRun(runId).catch(() => {});
                await qc.invalidateQueries({ queryKey: ['run', runId] });
              }
            : undefined
        }
        onSend={async (text) => {
          await api.postMessage(runId, { text, context: interview ? [] : context, attachments: interview ? [] : files });
          // What was sent, and the answer to it, show
          atEnd.current = true;
          if (run && !interview) {
            chatContext.clear(run.workspace);
            chatFiles.clear(run.workspace);
          }
          await qc.invalidateQueries({ queryKey: ['run', runId] });
        }}
      />
      </View>
    </KeyboardAvoidingView>
    </EntityLinks>
  );
}
