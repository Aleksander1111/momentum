import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { ReferenceView } from '@momentum/contract';
import { api } from '../lib/api';
import { H } from './Text';
import { Chevron, Count, List, Row, RowText, useFrame } from './parts';
import { EntityRefs } from './EntityRef';

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

/** What an entity has beyond its card: its references and artifacts, each folded until opened */
export function EntityMore({ ws, path }: { ws: string; path: string }) {
  const { data: e } = useEntity(ws, path);
  const frame = useFrame();
  return (
    <>
      {e?.references.length ? (
        <Fold title="References" count={e.references.length}>
          <View style={[frame, { padding: frame.borderWidth ? 14 : 0 }]}>
            <EntityRefs
              workspace={e.workspace}
              items={e.references.map((r) => ({ path: r.path, title: r.title, type: r.type, note: relationNote(r) }))}
            />
          </View>
        </Fold>
      ) : null}
      {e?.artifacts.length ? (
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
    </>
  );
}
