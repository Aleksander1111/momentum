import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import type { EntityDetail, ReferenceView } from '@momentum/contract';
import { api, HttpError } from '../lib/api';
import { C } from './theme';
import { H, T } from './Text';
import { States } from './StateBadge';
import { CardView } from './CardView';
import { CardScreen } from './CardScreen';
import { Chevron, Count, List, Row, RowText, useFrame } from './parts';
import { EntityLinks, EntityRefs, entityName } from './EntityRef';
import { MicButton } from './MicButton';
import { useVoice } from '../lib/voice';
import { snapshot } from '../lib/snapshot';
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

/** An entity a link still names but the graph no longer holds: an issue resolved, an entity retired */
function Gone({ ws, path }: { ws: string; path: string }) {
  return (
    <T style={{ color: C.muted, fontSize: 14.5, lineHeight: 21, paddingVertical: 24 }}>
      {`${entityName(path).name} is no longer in the knowledge graph of ${ws}: it was retired or resolved. The timeline shows what became of it.`}
    </T>
  );
}

/** What the entity has beyond its card: its references and artifacts, each folded until opened, and the mic */
function More({ e }: { e: EntityDetail }) {
  const wide = useWide();
  const frame = useFrame();
  const qc = useQueryClient();
  // Said about this entity: a command changes it, a question asks about it; either opens its chat
  const mic = useVoice({ kind: 'entity', workspace: e.workspace, path: e.path }, (o) => {
    if (!o.runId) return;
    void qc.invalidateQueries({ queryKey: ['entity', e.workspace, e.path] });
    openRun(o.runId, wide);
  });
  return (
    <>
      {e.references.length ? (
        <Fold title="References" count={e.references.length}>
          <View style={[frame, { padding: frame.borderWidth ? 14 : 0 }]}>
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
      {snapshot ? null : (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 }}>
          <MicButton listening={mic.listening} available={mic.available} onPress={mic.listening ? mic.stop : mic.start} />
        </View>
      )}
    </>
  );
}

const states = (e: EntityDetail) => <States verification={e.verification} sync={e.sync} contradictions={e.contradictions} labels />;

/** One entity in full and still, as the exported app shows it: breadcrumb, states, card, then what it has beyond it. */
export function EntityView({ ws, path, onOpen }: { ws: string; path: string; onOpen: (path: string) => void }) {
  const { data: e, error } = useEntity(ws, path);
  if (error instanceof HttpError && error.status === 404) return <Gone ws={ws} path={path} />;
  if (!e) return null;
  return (
    <EntityLinks workspace={e.workspace} open={onOpen}>
      <CardView type={e.type} workspace={e.workspace} path={e.path} title={e.title} card={e.card} diff={e.diff} aside={states(e)} />
      <More e={e} />
    </EntityLinks>
  );
}

/**
 * One entity as a card to react to, as the feed shows it: swiped right it approves or resolves, left it asks for rework,
 * pulled up it opens its chat. Its states sit beside the card, what it has beyond it below. `head` sits above it, such
 * as a way back; `onReacted` follows each reaction sent.
 */
export function EntityCard({
  ws,
  path,
  head,
  onOpen,
  onReacted,
}: {
  ws: string;
  path: string;
  head?: ReactNode;
  onOpen: (path: string) => void;
  onReacted: () => void;
}) {
  const { data: e, error } = useEntity(ws, path);
  const wide = useWide();
  const gone = error instanceof HttpError && error.status === 404;
  return (
    <EntityLinks workspace={ws} open={onOpen}>
      <CardScreen
        item={e}
        head={head}
        empty={gone ? <View style={{ paddingHorizontal: wide ? 40 : 16 }}><Gone ws={ws} path={path} /></View> : null}
        aside={e ? states(e) : null}
        below={e ? <More e={e} /> : null}
        onReacted={onReacted}
      />
    </EntityLinks>
  );
}
