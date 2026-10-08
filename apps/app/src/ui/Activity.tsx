import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import type { RetrievalRating, RunStep, RunTurn } from '@momentum/contract';
import { C, F } from './theme';
import { T } from './Text';
import { Chevron } from './icons';

/** "0:07", "1:42", "1:02:05" */
export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** "840", "2.1k", "38k" */
export function tokens(n: number): string {
  if (n < 1000) return String(n);
  return n < 10_000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n / 1000)}k`;
}

/** A step's time: "0.4 s", "12 s", "1:05" */
function stepTime(s: RunStep, now: number): string {
  const ms = (s.endedAt ? new Date(s.endedAt).getTime() : now) - new Date(s.startedAt).getTime();
  if (ms < 10_000) return `${(Math.max(0, ms) / 1000).toFixed(1)} s`;
  return ms < 60_000 ? `${Math.round(ms / 1000)} s` : clock(ms);
}

const pctOf = (v: number) => `${Math.round(v * 100)}%`;

function useNow(live: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [live]);
  return live ? now : Date.now();
}

function StepMark({ s }: { s: RunStep }) {
  if (!s.endedAt) return <ActivityIndicator size={10} color={C.accent} style={{ width: 12 }} />;
  return <T style={{ width: 12, fontSize: 12, textAlign: 'center', color: s.error ? C.no : C.ok }}>{s.error ? '✕' : '✓'}</T>;
}

function StepRow({ s, depth, now }: { s: RunStep; depth: number; now: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: depth * 16, minHeight: 20 }}>
      <StepMark s={s} />
      <T numberOfLines={1} style={{ fontSize: 12.5, fontFamily: F.mono, flexShrink: 0 }}>
        {s.name}
      </T>
      <T numberOfLines={1} style={{ fontSize: 12.5, fontFamily: F.mono, color: C.muted, flex: 1, minWidth: 0 }}>
        {s.detail}
      </T>
      <T style={{ fontSize: 11.5, color: C.muted, fontVariant: ['tabular-nums'] }}>{stepTime(s, now)}</T>
    </View>
  );
}

/** Steps in the order they were made, each sub-agent's own calls under it */
function StepTree({ steps, now }: { steps: RunStep[]; now: number }) {
  const ids = new Set(steps.map((s) => s.id));
  const children = new Map<string, RunStep[]>();
  for (const s of steps) if (s.parent && ids.has(s.parent)) children.set(s.parent, [...(children.get(s.parent) ?? []), s]);
  const rows: { s: RunStep; depth: number }[] = [];
  const walk = (s: RunStep, depth: number) => {
    rows.push({ s, depth });
    for (const c of children.get(s.id) ?? []) walk(c, depth + 1);
  };
  for (const s of steps) if (!s.parent || !ids.has(s.parent)) walk(s, 0);
  return (
    <View style={{ gap: 2 }}>
      {rows.map(({ s, depth }) => (
        <StepRow key={s.id} s={s} depth={depth} now={now} />
      ))}
    </View>
  );
}

function Retrieval({ r }: { r: RetrievalRating }) {
  return (
    <View style={{ gap: 6 }}>
      <T style={{ fontSize: 12.5, color: C.muted }}>
        {`Retrieval ${pctOf(r.score)} · precision ${pctOf(r.precision)} · coverage ${pctOf(r.coverage)} · ${r.parallel ? 'tools in parallel' : 'tools one by one'}`}
      </T>
      {r.summary ? <T style={{ fontSize: 13 }}>{r.summary}</T> : null}
      {r.tools.map((t) => (
        <View key={t.tool} style={{ gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <T numberOfLines={1} style={{ fontSize: 12.5, fontFamily: F.mono, width: 150 }}>
              {t.tool}
            </T>
            <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: C.card, overflow: 'hidden' }}>
              <View style={{ width: `${Math.round(t.relative * 100)}%`, height: 8, borderRadius: 4, backgroundColor: C.accent }} />
            </View>
            <T style={{ fontSize: 11.5, color: C.muted, width: 74, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
              {`${t.relevance.toFixed(1)}/5 · ×${t.calls}`}
            </T>
          </View>
          {t.note ? <T style={{ fontSize: 12, color: C.muted, paddingLeft: 158 }}>{t.note}</T> : null}
        </View>
      ))}
    </View>
  );
}

/**
 * What the agent did for one turn, as Claude Code shows it while it works: the time, the tool calls and the tokens,
 * collapsed to one line with the call under way; once the turn is rated, how well each retrieval tool served it
 */
export function TurnActivity({ turn, live }: { turn: RunTurn; live: boolean }) {
  const [open, setOpen] = useState(false);
  const now = useNow(live);
  const started = new Date(turn.startedAt).getTime();
  const answered = turn.answeredAt ? new Date(turn.answeredAt).getTime() : null;
  const ended = turn.endedAt ? new Date(turn.endedAt).getTime() : null;
  const work = turn.steps.filter((s) => !s.bookkeeping);
  const after = turn.steps.filter((s) => s.bookkeeping);
  const running = turn.steps.filter((s) => !s.endedAt);
  const current = running[running.length - 1] ?? null;
  const tools = work.length === 1 ? '1 tool' : `${work.length} tools`;
  const out = turn.outputTokens ? ` · ↓ ${tokens(turn.outputTokens)} tokens` : '';

  let head: string;
  if (live && answered === null) head = `Working · ${clock(now - started)} · ${tools}${out}`;
  else if (live) head = `Answered in ${clock(answered! - started)} · wrapping up ${clock(now - answered!)} · ${tools}${out}`;
  else head = `Worked ${clock((answered ?? ended ?? now) - started)} · ${tools}${out}`;
  const rag =
    turn.retrievalState === 'rated' && turn.retrieval
      ? `RAG ${pctOf(turn.retrieval.score)}`
      : turn.retrievalState === 'pending'
        ? 'rating retrieval…'
        : null;

  return (
    <View style={{ alignSelf: 'stretch', borderWidth: 1, borderColor: C.line, borderRadius: 12, backgroundColor: C.card }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={open ? 'Hide what the agent did' : 'Show what the agent did'}
        onPress={() => setOpen((o) => !o)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 12 }}
      >
        {live ? <ActivityIndicator size={12} color={C.accent} /> : <T style={{ fontSize: 12, color: C.ok }}>✓</T>}
        <View style={{ flex: 1, minWidth: 0 }}>
          <T numberOfLines={1} style={{ fontSize: 13, fontVariant: ['tabular-nums'] }}>
            {head}
            {rag ? <T style={{ color: turn.retrievalState === 'rated' ? C.accent : C.muted }}>{` · ${rag}`}</T> : null}
          </T>
          {live && current && !open ? (
            <T numberOfLines={1} style={{ fontSize: 12, fontFamily: F.mono, color: C.muted, marginTop: 2 }}>
              {`${current.name} ${current.detail}`}
            </T>
          ) : null}
        </View>
        <Chevron open={open} />
      </Pressable>
      {open ? (
        <View style={{ gap: 10, paddingHorizontal: 12, paddingBottom: 10 }}>
          {work.length ? <StepTree steps={work} now={now} /> : <T style={{ fontSize: 12.5, color: C.muted }}>No tools called</T>}
          {after.length ? (
            <View style={{ gap: 4 }}>
              <T style={{ fontSize: 11.5, color: C.muted }}>After the answer: summarizing and the commit message</T>
              <StepTree steps={after} now={now} />
            </View>
          ) : null}
          {turn.contextTokens ? (
            <T style={{ fontSize: 11.5, color: C.muted }}>{`Context ${tokens(turn.contextTokens)} tokens · wrote ${tokens(turn.outputTokens)}`}</T>
          ) : null}
          {turn.retrievalState === 'rated' && turn.retrieval ? <Retrieval r={turn.retrieval} /> : null}
        </View>
      ) : null}
    </View>
  );
}
