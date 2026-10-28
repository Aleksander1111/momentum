import { View } from 'react-native';
import { HttpError } from '../lib/api';
import { C, useWide } from './theme';
import { T } from './Text';
import { States } from './StateBadge';
import { CardView } from './CardView';
import { CardScreen } from './CardScreen';
import { EntityLinks, entityName } from './EntityRef';
import { EntityMore, useEntity } from './EntityParts';

/** An entity a link still names but the graph no longer holds: an issue resolved, an entity retired */
function Gone({ ws, path }: { ws: string; path: string }) {
  return (
    <T style={{ color: C.muted, fontSize: 14.5, lineHeight: 21, paddingVertical: 24 }}>
      {`${entityName(path).name} is no longer in the knowledge graph of ${ws}: it was retired or resolved. The timeline shows what became of it.`}
    </T>
  );
}

/**
 * One entity in full and still, as the exported app shows it: breadcrumb, states, card, then what it has beyond it.
 * `onProject`, when given, is what the project logo does in place of opening the explorer.
 */
export function EntityView({
  ws,
  path,
  onOpen,
  onProject,
}: {
  ws: string;
  path: string;
  onOpen: (path: string) => void;
  onProject?: () => void;
}) {
  const { data: e, error } = useEntity(ws, path);
  if (error instanceof HttpError && error.status === 404) return <Gone ws={ws} path={path} />;
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
        aside={<States verification={e.verification} sync={e.sync} contradictions={e.contradictions} />}
        onProject={onProject}
      />
      <EntityMore ws={e.workspace} path={e.path} />
    </EntityLinks>
  );
}

/**
 * One entity as the feed's card, the same in every part: swiped right it approves or resolves, left it asks for rework,
 * pulled up it opens its chat. `onReacted` follows each reaction sent; `onProject`, when given, is what the project logo
 * does in place of opening the explorer.
 */
export function EntityCard({
  ws,
  path,
  onOpen,
  onReacted,
  onProject,
}: {
  ws: string;
  path: string;
  onOpen: (path: string) => void;
  onReacted: () => void;
  onProject?: () => void;
}) {
  const { data: e, error } = useEntity(ws, path);
  const wide = useWide();
  const gone = error instanceof HttpError && error.status === 404;
  return (
    <EntityLinks workspace={ws} open={onOpen}>
      <CardScreen
        item={e}
        empty={gone ? <View style={{ paddingHorizontal: wide ? 40 : 16 }}><Gone ws={ws} path={path} /></View> : null}
        onReacted={onReacted}
        onProject={onProject}
      />
    </EntityLinks>
  );
}
