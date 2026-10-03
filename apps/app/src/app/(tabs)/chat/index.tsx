import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View, type TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { useWorkspaces } from '../../../lib/workspace';
import { ProjectLogo } from '../../../ui/ProjectLogo';
import { chatContext, useChatContext } from '../../../lib/context';
import { relativeTime, runKind } from '../../../lib/format';
import { useTheme, useWide } from '../../../ui/theme';
import { List, Row, RowText, Sect } from '../../../ui/parts';
import { States } from '../../../ui/StateBadge';
import { Composer } from '../../../ui/Composer';
import { Conversation } from '../../../ui/Conversation';

export default function Chats() {
  useTheme();
  const wide = useWide();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ ws?: string; compose?: string; run?: string }>();
  const { data: workspaces } = useWorkspaces();
  const names = (workspaces ?? []).map((w) => w.name);
  const [lastGroup, setLastGroup] = useState<string | null>(null);
  const composer = useRef<TextInput>(null);

  const chats = useQueries({
    queries: names.map((ws) => ({
      queryKey: ['chats', ws],
      queryFn: () => api.chats(ws),
      refetchInterval: 15_000,
    })),
  });

  // "Explore through an agent" lands here with the workspace chosen and the composer focused.
  useEffect(() => {
    if (params.ws) setLastGroup(params.ws);
    if (params.compose) composer.current?.focus();
  }, [params.ws, params.compose]);

  const target = lastGroup ?? (workspaces ?? []).find((w) => w.enabled)?.name ?? names[0] ?? null;
  const context = useChatContext(target);

  const openRun = (runId: string) => {
    if (wide) router.setParams({ run: runId, compose: undefined });
    else router.push({ pathname: '/chat/[runId]', params: { runId } });
  };

  const list = (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={
        wide
          ? { flexGrow: 0, flexShrink: 0, flexBasis: 380, paddingTop: 12, paddingHorizontal: 16, paddingBottom: 24 }
          : { flex: 1, paddingTop: 12, paddingHorizontal: 16, paddingBottom: 24 }
      }
    >
      <ScrollView style={{ flex: 1 }}>
        {names.map((ws, i) => {
          const items = chats[i]?.data?.chats ?? [];
          if (!items.length) return null;
          return (
            <View key={ws}>
              <Sect first={names.findIndex((n, j) => (chats[j]?.data?.chats.length ?? 0) > 0) === i} icon={<ProjectLogo name={ws} size={22} />}>
                {ws}
              </Sect>
              <List>
                {items.map((c, k) => (
                  <Row
                    key={c.runId}
                    first={k === 0}
                    selected={wide && params.run === c.runId}
                    onPress={() => {
                      setLastGroup(ws);
                      openRun(c.runId);
                    }}
                  >
                    <RowText
                      title={c.title}
                      sub={`${runKind(c.automation)} · ${c.status} · ${relativeTime(c.updatedAt)}`}
                    />
                    <States verification={c.verification} sync={c.sync} />
                  </Row>
                ))}
              </List>
            </View>
          );
        })}
      </ScrollView>
      <View style={{ paddingTop: 12 }}>
        <Composer
          ref={composer}
          placeholder={`Ask ${target ?? ''}`.trim()}
          context={context}
          voice={{
            target: target ? { kind: 'chat', workspace: target, context } : null,
            onOutcome: (o) => {
              if (!o.runId || !o.workspace) return;
              if (o.created && o.workspace === target) chatContext.clear(target);
              void qc.invalidateQueries({ queryKey: ['chats', o.workspace] });
              openRun(o.runId);
            },
          }}
          onSend={async (text) => {
            if (!target) return;
            const { runId } = await api.createChat(target, { text, context });
            chatContext.clear(target);
            await qc.invalidateQueries({ queryKey: ['chats', target] });
            openRun(runId);
          }}
        />
      </View>
    </KeyboardAvoidingView>
  );

  if (!wide) return list;

  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      {list}
      <View style={{ flex: 1, paddingTop: 20, paddingHorizontal: 40, paddingBottom: 24 }}>
        {params.run ? <Conversation key={params.run} runId={params.run} /> : null}
      </View>
    </View>
  );
}
