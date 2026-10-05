import { useRef } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { RunDetail, VoiceTarget } from '@momentum/contract';
import { api } from '../lib/api';
import { automationLabel, duration, usagePct } from '../lib/format';
import { openRun } from '../lib/runs';
import { C, F, useWide } from './theme';
import { T } from './Text';
import { Markdown } from './Markdown';
import { Composer, ContextChip } from './Composer';
import { chatContext, useChatContext } from '../lib/context';
import { Btn } from './parts';
import { EntityLinks } from './EntityRef';

const ACTIVE = new Set(['queued', 'running']);

/** Automation, state, what the run has used so far, and Stop while it is active */
function RunHead({ run, onStop }: { run: RunDetail; onStop: () => void }) {
  const running = run.status === 'running';
  const state = running && run.startedAt ? `running ${duration(run.startedAt)}` : run.status;
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
        <T style={{ fontFamily: F.mono, fontSize: 12.5, color: C.muted, marginTop: 2 }}>{run.id}</T>
      </View>
      {ACTIVE.has(run.status) ? <Btn small kind="ghost" label="Stop" onPress={onStop} /> : null}
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

/** Run header, messages and the message composer; polls the run while it is active. */
export function Conversation({ runId }: { runId: string }) {
  const qc = useQueryClient();
  const wide = useWide();
  const scroll = useRef<ScrollView>(null);
  const { data: run } = useQuery({
    queryKey: ['run', runId],
    queryFn: () => api.run(runId),
    refetchInterval: (q) => (q.state.data && !ACTIVE.has(q.state.data.status) ? false : 3_000),
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
        {(run?.messages ?? []).map((m) =>
          m.role === 'user' ? (
            <View
              key={m.seq}
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
          ) : (
            <View
              key={m.seq}
              style={{
                alignSelf: 'flex-start',
                maxWidth: '84%',
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
