import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import type { EntityListItem, TypeNode } from '@momentum/contract';
import { api } from '../../../lib/api';
import { useCurrentWorkspace } from '../../../lib/workspace';
import { C, useTheme, useWide } from '../../../ui/theme';
import { T } from '../../../ui/Text';
import { Icon, Triangle } from '../../../ui/icons';
import { Field } from '../../../ui/Field';
import { MicButton } from '../../../ui/MicButton';
import { useVoice } from '../../../lib/voice';
import { openRun } from '../../../lib/runs';
import { Count, List, Pick, Row, RowText } from '../../../ui/parts';
import { States } from '../../../ui/StateBadge';
import { EntityView } from '../../../ui/EntityView';
import { DomainBadge } from '../../../ui/domains';
import { useCornerRoom } from '../../../ui/SettingsButton';

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const indent = (depth: number) => 14 + depth * 16;

function EntityRow({
  e,
  depth,
  first,
  selected,
  onOpen,
}: {
  e: EntityListItem;
  depth: number;
  first: boolean;
  selected: boolean;
  onOpen: (path: string) => void;
}) {
  return (
    <Row first={first} selected={selected} onPress={() => onOpen(e.path)} style={{ paddingLeft: indent(depth) }}>
      <DomainBadge type={e.type} />
      <RowText title={e.title} size={14.5} />
      <States verification={e.verification} sync={e.sync} contradictions={e.contradictions} />
    </Row>
  );
}

function treeRows(
  nodes: TypeNode[],
  depth: number,
  open: Set<string>,
  toggle: (path: string) => void,
  selected: string | null,
  onOpen: (path: string) => void,
  out: ReactNode[],
) {
  for (const n of nodes) {
    const isOpen = open.has(n.path);
    out.push(
      <Row
        key={`t:${n.path}`}
        first={out.length === 0}
        onPress={() => toggle(n.path)}
        style={{ paddingLeft: indent(depth) }}
      >
        <Triangle open={isOpen} />
        <DomainBadge type={n.path} />
        <RowText title={n.name} />
        <Count>{n.count}</Count>
      </Row>,
    );
    if (!isOpen) continue;
    treeRows(n.children, depth + 1, open, toggle, selected, onOpen, out);
    for (const e of n.entities) {
      out.push(
        <EntityRow
          key={`e:${e.path}`}
          e={e}
          depth={depth + 1}
          first={out.length === 0}
          selected={e.path === selected}
          onOpen={onOpen}
        />,
      );
    }
  }
}

export default function Explorer() {
  useTheme();
  const wide = useWide();
  const corner = useCornerRoom();
  const params = useLocalSearchParams<{ ws?: string; path?: string; folder?: string }>();
  const [ws, setWs, names] = useCurrentWorkspace();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');

  // A breadcrumb elsewhere opens a workspace, and the tree down to one of its folders.
  useEffect(() => {
    if (!params.ws) return;
    setWs(params.ws);
    if (params.folder === undefined) return;
    const segs = params.folder.split('/');
    setQ('');
    setOpen((s) => new Set([...s, ...segs.map((_, i) => segs.slice(0, i + 1).join('/'))]));
  }, [params.ws, params.folder]);
  const dq = useDebounced(q.trim(), 300);
  // Spoken search words fill the search; an interview started by voice opens
  const mic = useVoice(ws ? { kind: 'search', workspace: ws } : null, (o) => {
    if (o.kind === 'search' && o.text) setQ(o.text);
    else if (o.runId) openRun(o.runId, wide);
  });
  const [lastOpened, setLastOpened] = useState<string | null>(null);

  const types = useQuery({ queryKey: ['types', ws], queryFn: () => api.types(ws as string), enabled: !!ws });
  const search = useQuery({
    queryKey: ['search', ws, dq],
    queryFn: () => api.search(ws as string, dq),
    enabled: !!ws && dq.length > 0,
  });

  const selected = wide ? (params.ws === ws ? (params.path ?? null) : null) : lastOpened;

  const onOpen = (path: string) => {
    if (!ws) return;
    if (wide) {
      router.setParams({ ws, path });
    } else {
      setLastOpened(path);
      router.push({ pathname: '/explorer/entity', params: { ws, path } });
    }
  };

  const toggle = (path: string) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const rows: ReactNode[] = [];
  if (dq) {
    (search.data?.results ?? []).forEach((e, i) =>
      rows.push(
        <EntityRow key={e.path} e={e} depth={0} first={i === 0} selected={e.path === selected} onOpen={onOpen} />,
      ),
    );
  } else {
    treeRows(types.data?.types ?? [], 0, open, toggle, selected, onOpen, rows);
  }

  const tree = (
    <ScrollView
      style={wide ? { flexGrow: 0, flexShrink: 0, flexBasis: 420, borderRightWidth: 1, borderRightColor: C.line } : { flex: 1 }}
      contentContainerStyle={{ paddingTop: 12, paddingHorizontal: 16, paddingBottom: 24 }}
      keyboardShouldPersistTaps="handled"
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
          paddingRight: corner,
          zIndex: 10,
        }}
      >
        <Pick value={ws} options={names} onChange={setWs} />
        {types.data ? <Count>{`${types.data.total} entities`}</Count> : null}
      </View>
      <Field
        icon="search"
        placeholder="Search entities"
        value={mic.listening || mic.partial !== null ? (mic.partial ?? '') : q}
        onChangeText={setQ}
        autoCorrect={false}
        editable={!mic.listening}
        trailing={<MicButton bare listening={mic.listening} available={mic.available && !!ws} onPress={mic.listening ? mic.stop : mic.start} />}
      />
      <Pressable
        onPress={() => ws && router.navigate({ pathname: '/chat', params: { ws, compose: '1' } })}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: C.card,
          borderRadius: 12,
          paddingVertical: 11,
          paddingHorizontal: 14,
          marginTop: 10,
          marginBottom: 14,
        }}
      >
        <Icon name="agent" size={20} color={C.ink} />
        <T style={{ fontSize: 14.5 }}>Explore through an agent</T>
      </Pressable>
      {rows.length ? <List>{rows}</List> : null}
    </ScrollView>
  );

  if (!wide) return tree;

  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      {tree}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 28, paddingHorizontal: 40 }}>
        {ws && selected ? <EntityView ws={ws} path={selected} onOpen={onOpen} /> : null}
      </ScrollView>
    </View>
  );
}
