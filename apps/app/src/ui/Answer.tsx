import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { entityLinkTarget } from '@momentum/contract';
import { api } from '../lib/api';
import { openRun } from '../lib/runs';
import { C, useWide } from './theme';
import { T } from './Text';
import { Icon } from './icons';
import { Markdown } from './Markdown';
import { EntityRefs } from './EntityRef';

const ASKING =
  /^(what|whats|what's|how|why|when|where|who|whom|whose|which|is|are|was|were|does|do|did|can|could|should|would|will|has|have|explain|summarize|summarise|describe|list|show|tell|compare)\b/i;

/** A question rather than keywords: it ends with a question mark, or starts as questions and requests do and runs on */
export function isQuestion(q: string): boolean {
  const t = q.trim();
  if (t.endsWith('?')) return t.length > 3;
  return ASKING.test(t) && t.split(/\s+/).length >= 3;
}

/** Faint bars that breathe while the answer is written */
function Pending() {
  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0.45, duration: 700, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View style={{ gap: 8, opacity: pulse, marginTop: 4 }}>
      {['92%', '100%', '74%'].map((w) => (
        <View key={w} style={{ height: 11, width: w as `${number}%`, borderRadius: 6, backgroundColor: C.line }} />
      ))}
    </Animated.View>
  );
}

/**
 * The answer to what was asked in the knowledge graph search, above its results: written from the entities the search
 * found, each it draws from linked in place and listed by type beneath it; a chat takes the question further.
 */
export function Answer({ ws, q }: { ws: string; q: string }) {
  const wide = useWide();
  const [showAll, setShowAll] = useState(false);
  const answer = useQuery({
    queryKey: ['ask', ws, q.trim().toLowerCase()],
    queryFn: () => api.ask(ws, q),
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    retry: false,
  });
  const chat = useMutation({
    mutationFn: () => api.createChat(ws, { text: q, context: [] }),
    onSuccess: ({ runId }) => openRun(runId, wide),
  });
  const data = answer.data;
  const cited = new Set(
    [...(data?.answer ?? '').matchAll(/\]\(\s*<?([^)\s>]+)>?\s*\)/g)].map((m) => entityLinkTarget(m[1] ?? '')).filter(Boolean),
  );
  const sources = (data?.sources ?? []).filter((s) => showAll || cited.has(s.path));
  const more = (data?.sources.length ?? 0) - cited.size;
  return (
    <View
      accessibilityLabel="Answer"
      style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 14, marginBottom: 14, gap: 10 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="agent" size={17} color={C.accent} />
        <T style={{ fontSize: 13, fontWeight: '700', color: C.accent }}>Answer</T>
      </View>
      {answer.isPending ? <Pending /> : null}
      {answer.isError ? (
        <View style={{ gap: 8 }}>
          <T style={{ color: C.muted, fontSize: 14 }}>The answer could not be written.</T>
          <Pressable onPress={() => void answer.refetch()} accessibilityRole="button" style={{ alignSelf: 'flex-start' }}>
            <T style={{ color: C.accent, fontSize: 13.5, fontWeight: '700' }}>Try again</T>
          </Pressable>
        </View>
      ) : null}
      {data ? (
        <>
          <Markdown text={data.answer} style={{ fontSize: 14.5, lineHeight: 21 }} />
          {sources.length ? (
            <View style={{ gap: 8, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10 }}>
              <T style={{ color: C.muted, fontSize: 11.5 }}>{showAll ? 'Everything the search read' : 'Drawn from'}</T>
              <EntityRefs workspace={ws} items={sources.map((s) => ({ path: s.path, title: s.title, type: s.type }))} size={13} />
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18 }}>
            <Pressable onPress={() => chat.mutate()} disabled={chat.isPending} accessibilityRole="button" hitSlop={6}>
              <T style={{ color: C.accent, fontSize: 13.5, fontWeight: '700' }}>{chat.isPending ? 'Opening a chat…' : 'Ask more in a chat'}</T>
            </Pressable>
            {more > 0 ? (
              <Pressable onPress={() => setShowAll((s) => !s)} accessibilityRole="button" hitSlop={6}>
                <T style={{ color: C.muted, fontSize: 13.5 }}>{showAll ? 'Only what it drew from' : `${more} more it read`}</T>
              </Pressable>
            ) : null}
          </View>
        </>
      ) : null}
    </View>
  );
}
