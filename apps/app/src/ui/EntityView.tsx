import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import type { ReferenceView } from '@momentum/contract';
import { api } from '../lib/api';
import { C } from './theme';
import { H } from './Text';
import { States } from './StateBadge';
import { CardView } from './CardView';
import { Chevron, Count, List, Row, RowText } from './parts';
import { EntityLinks, EntityRefs } from './EntityRef';
import { MicButton } from './MicButton';
import { useVoice } from '../lib/voice';
import { openRun } from '../lib/runs';
import { useWide } from './theme';

export function useEntity(ws: string | null | undefined, path: string | null | undefined) {
  return useQuery({
    queryKey: ['entity', ws, path],
    queryFn: () => api.entity(ws as string, path as string),
    enabled: !!ws && !!path,
  });
}

/** A section of the entity that opens on a press: its heading, how many it holds, and a chevron; closed at first */
function Fold({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginTop: 22 }}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, alignSelf: 'flex-start' }}
      >
        <H style={{ fontSize: 16 }}>{title}</H>
        <Count>{count}</Count>
        <Chevron open={open} />
      </Pressable>
      {open ? children : null}
    </View>
  );
}

/** "depends_on" out → "depends on"; "implements" in → "implements this" */
const relationNote = (r: ReferenceView) => `${r.relation.replace(/_/g, ' ')}${r.direction === 'in' ? ' this' : ''}`;

/** One entity in full: breadcrumb, states, card, then its references and artifacts, each folded until opened. */
export function EntityView({
  ws,
  path,
  onOpen,
}: {
  ws: string;
  path: string;
  onOpen: (path: string) => void;
}) {
  const { data: e } = useEntity(ws, path);
  const wide = useWide();
  const qc = useQueryClient();
  // Said about this entity: a command changes it, a question asks about it; either opens its chat
  const mic = useVoice({ kind: 'entity', workspace: ws, path }, (o) => {
    if (!o.runId) return;
    void qc.invalidateQueries({ queryKey: ['entity', ws, path] });
    openRun(o.runId, wide);
  });
  if (!e) return null;
  return (
    <EntityLinks workspace={e.workspace} open={onOpen}>
      <CardView
        type={e.type}
        workspace={e.workspace}
        path={e.path}
        title={e.title}
        card={e.card}
        diff={e.diff}
        aside={<States verification={e.verification} sync={e.sync} contradictions={e.contradictions} labels />}
      />
      {e.references.length ? (
        <Fold title="References" count={e.references.length}>
          <View style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 14 }}>
            <EntityRefs
              workspace={e.workspace}
              items={e.references.map((r) => ({ path: r.path, title: r.title, type: r.type, note: relationNote(r) }))}
            />
          </View>
        </Fold>
      ) : null}
      {e.artifacts.length ? (
        <Fold title="Artifacts" count={e.artifacts.length}>
          <List>
            {e.artifacts.map((a, i) => (
              <Row key={a.path} first={i === 0}>
                <RowText title={a.path} sub={a.kind} />
              </Row>
            ))}
          </List>
        </Fold>
      ) : null}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 }}>
        <MicButton listening={mic.listening} available={mic.available} onPress={mic.listening ? mic.stop : mic.start} />
      </View>
    </EntityLinks>
  );
}
