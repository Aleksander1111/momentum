import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KeyboardAvoidingView, Platform, ScrollView, View, type TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { useCurrentWorkspace } from '../../../lib/workspace';
import { ProjectLogo } from '../../../ui/ProjectLogo';
import { chatContext, useChatContext } from '../../../lib/context';
import { relativeTime, runKind, runStatus, yours } from '../../../lib/format';
import { C, useTheme, useWide } from '../../../ui/theme';
import { T } from '../../../ui/Text';
import { Icon } from '../../../ui/icons';
import { List, Pick, Row, RowText, Sect, Segmented, useCloseOnBack } from '../../../ui/parts';
import { States } from '../../../ui/StateBadge';
import { Composer } from '../../../ui/Composer';
import { Conversation } from '../../../ui/Conversation';

type Filter = 'all' | 'yours' | 'automations';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'yours', label: 'Yours' },
  { value: 'automations', label: 'Automations' },
];
const FILTER_STORE = 'momentum.sessions.filter';

/** Which sessions the list shows, remembered on this device */
function useFilter(): [Filter, (f: Filter) => void] {
  const [filter, setFilter] = useState<Filter>('all');
  useEffect(() => {
    AsyncStorage.getItem(FILTER_STORE)
      .then((v) => {
        if (v && FILTERS.some((f) => f.value === v)) setFilter(v as Filter);
      })
      .catch(() => {});
  }, []);
  return [
    filter,
    (f) => {
      setFilter(f);
      void AsyncStorage.setItem(FILTER_STORE, f).catch(() => {});
    },
  ];
}

/** Your sessions and the automations' runs, told apart by who started them */
export default function Sessions() {
  useTheme();
  const wide = useWide();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ ws?: string; compose?: string; run?: string }>();
  // A new chat goes to the project chosen here, in Explorer or in Metrics, or to that of the chat opened last
  const [target, setTarget, names] = useCurrentWorkspace();
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
    if (params.ws) setTarget(params.ws);
    if (params.compose) composer.current?.focus();
  }, [params.ws, params.compose]);

  const context = useChatContext(target);
  const [filter, setFilter] = useFilter();
  const shown = (automation: Parameters<typeof yours>[0]) => filter === 'all' || (filter === 'yours') === yours(automation);
  const lists = names.map((ws, i) => (chats[i]?.data?.chats ?? []).filter((c) => shown(c.automation)));
  const loaded = chats.some((q) => q.data);

  // On a wide screen the chat open beside the list is a parameter, not a screen: back closes it
  useCloseOnBack(wide && !!params.run, () => router.setParams({ run: undefined }));

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
      <View style={{ marginBottom: 6 }}>
        <Segmented value={filter} options={FILTERS} onChange={setFilter} />
      </View>
      <ScrollView style={{ flex: 1 }}>
        {loaded && lists.every((l) => l.length === 0) ? (
          <T style={{ color: C.muted, fontSize: 13.5, marginTop: 16 }}>
            {filter === 'yours' ? 'No chats or interviews yet' : filter === 'automations' ? 'No automation runs yet' : 'No sessions yet'}
          </T>
        ) : null}
        {names.map((ws, i) => {
          const items = lists[i]!;
          if (!items.length) return null;
          return (
            <View key={ws}>
              <Sect first={lists.findIndex((l) => l.length > 0) === i} icon={<ProjectLogo name={ws} size={22} />}>
                {ws}
              </Sect>
              <List>
                {items.map((c, k) => (
                  <Row
                    key={c.runId}
                    first={k === 0}
                    selected={wide && params.run === c.runId}
                    onPress={() => {
                      setTarget(ws);
                      openRun(c.runId);
                    }}
                  >
                    <View accessibilityLabel={yours(c.automation) ? 'Yours' : 'Automation'} style={{ width: 20, alignItems: 'center' }}>
                      <Icon name={yours(c.automation) ? 'user' : 'agent'} size={18} color={yours(c.automation) ? C.accent : C.muted} />
                    </View>
                    <RowText
                      title={c.title}
                      sub={`${runKind(c.automation)} · ${runStatus(c.status)} · ${relativeTime(c.updatedAt)}`}
                    />
                    <States verification={c.verification} sync={c.sync} />
                  </Row>
                ))}
              </List>
            </View>
          );
        })}
      </ScrollView>
      <View style={{ paddingTop: 12, gap: 10, zIndex: 10 }}>
        {names.length > 1 ? (
          <Pick value={target} options={names} onChange={setTarget} up icon={(o, size) => <ProjectLogo name={o} size={size} />} />
        ) : null}
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
