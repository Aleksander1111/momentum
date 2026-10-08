import { Fragment, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { RunDetail, VoiceTarget } from '@momentum/contract';
import { api } from '../lib/api';
import { automationLabel, duration, runStatus, usagePct } from '../lib/format';
import { openRun } from '../lib/runs';
import { C, F, useWide } from './theme';
import { T } from './Text';
import { hasWideBlocks, Markdown } from './Markdown';
import { Composer, ContextChip } from './Composer';
import { chatContext, useChatContext } from '../lib/context';
import { Btn } from './parts';
import { EntityLinks, EntityRef } from './EntityRef';
import { useEntity } from './EntityView';
import { TurnActivity } from './Activity';

const ACTIVE = new Set(['queued', 'running']);
/** How long a chat waits for the rating of its last turn's retrieval */
const RATING_WAIT_MS = 3 * 60_000;

/** Whether the run still changes: it is under way, or a turn that ended moments ago is being rated */
function changing(run: RunDetail): boolean {
  if (ACTIVE.has(run.status)) return true;
  return run.turns.some((t) => t.retrievalState === 'pending' && t.endedAt && Date.now() - new Date(t.endedAt).getTime() < RATING_WAIT_MS);
}

/**
 * Automation, state, what the run has used so far, the card it is about, and Stop while it is active; `compact` leaves
 * out the run's id and the card, for a chat shown below its card
 */
function RunHead({ run, onStop, compact }: { run: RunDetail; onStop: () => Promise<void>; compact?: boolean }) {
  const [stopping, setStopping] = useState(false);
  // The time it has been running goes on while nothing else about the run changes
  const [, tick] = useState(0);
  useEffect(() => {
    if (run.status !== 'running') return;
    const t = setInterval(() => tick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, [run.status]);
  const target = useEntity(run.workspace, run.targetPath);
  const running = run.status === 'running';
  const state = stopping && ACTIVE.has(run.status) ? 'stopping' : running && run.startedAt ? `running ${duration(run.startedAt)}` : runStatus(run.status);
  const usage = run.usage.fiveHour !== null ? ` \u00b7 ${usagePct(run.usage.fiveHour)} of 5 h` : '';
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
      <View
        style={{
          width: 9,
          height: 9,
          borderRadius: 5,
          backgroundColor: running ? C.ok : C.muted,
          boxShadow: running ? `0 0 0 3px ${C.washOk}` : undefined,
        }}
      />
      <View style={{ flex: 1 }}>
        <T style={{ fontSize: 13.5 }}>{`${automationLabel(run.automation)} · ${state}${usage}`}</T>
        {compact ? null : <T style={{ fontFamily: F.mono, fontSize: 12.5, color: C.muted, marginTop: 2 }}>{run.id}</T>}
        {run.targetPath && !compact ? (
          <View style={{ marginTop: 4 }}>
            <EntityRef workspace={run.workspace} path={run.targetPath} title={target.data?.title} size={13} />
          </View>
        ) : null}
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
  const { data } = useQuery({
    queryKey: ['artifact', run.workspace, document, run.messages.length, run.status],
    queryFn: () => api.artifact(run.workspace, document as string),
    enabled: !!document,
    retry: false,
  });
  if (!data) return null;
  return (
    <View style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 }}>
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

/** Run header, messages and the message composer; polls the run while it is active. `compact` keeps the header to a line. */
export function Conversation({ runId, compact }: { runId: string; compact?: boolean }) {
  const qc = useQueryClient();
  const wide = useWide();
  const scroll = useRef<ScrollView>(null);
  const { data: run } = useQuery({
    queryKey: ['run', runId],
    queryFn: () => api.run(runId),
    refetchInterval: (q) => (q.state.data && !changing(q.state.data) ? false : 2_000),
  });
  const context = useChatContext(run?.workspace ?? null);
  const interview = run?.automation === 'interview';
  const target: VoiceTarget | null = !run
    ? null
    : interview
      ? { kind: 'interview', workspace: run.workspace, runId }
      : { kind: 'chat', workspace: run.workspace, runId, context };

  return (
    // Entities the messages name open from them
    <EntityLinks workspace={run?.workspace ?? null}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      {run ? (
        <RunHead
          run={run}
          compact={compact}
          onStop={async () => {
            await api.killRun(runId);
            await qc.invalidateQueries({ queryKey: ['run', runId] });
          }}
        />
      ) : null}
      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: 10, paddingVertical: 12 }}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
      >
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
      </ScrollView>
      <Composer
        placeholder={interview ? 'Answer' : 'Message'}
        context={interview ? undefined : context}
        voice={{
          target,
          onOutcome: (o) => {
            if (!o.runId) return;
            if (o.runId !== runId) return openRun(o.runId, wide);
            if (run && !interview) chatContext.clear(run.workspace);
            void qc.invalidateQueries({ queryKey: ['run', runId] });
          },
        }}
        onSend={async (text) => {
          await api.postMessage(runId, { text, context: interview ? [] : context });
          if (run && !interview) chatContext.clear(run.workspace);
          await qc.invalidateQueries({ queryKey: ['run', runId] });
        }}
      />
    </KeyboardAvoidingView>
    </EntityLinks>
  );
}
