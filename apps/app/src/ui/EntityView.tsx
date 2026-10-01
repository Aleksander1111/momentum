import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { lastSegment } from '../lib/format';
import { C } from './theme';
import { T } from './Text';
import { States } from './StateBadge';
import { CardView } from './CardView';
import { Chevron, List, Row, RowText, Sect } from './parts';

export function useEntity(ws: string | null | undefined, path: string | null | undefined) {
  return useQuery({
    queryKey: ['entity', ws, path],
    queryFn: () => api.entity(ws as string, path as string),
    enabled: !!ws && !!path,
  });
}

/** One entity in full: breadcrumb, states, card, references and artifacts. */
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
  if (!e) return null;
  return (
    <View>
      <CardView
        type={e.type}
        workspace={e.workspace}
        path={e.path}
        title={e.title}
        card={e.card}
        aside={<States verification={e.verification} sync={e.sync} contradictions={e.contradictions} labels />}
      />
      {e.references.length ? (
        <>
          <Sect>References</Sect>
          <List>
            {e.references.map((r, i) => (
              <Row key={`${r.direction}:${r.relation}:${r.path}`} first={i === 0} onPress={() => onOpen(r.path)}>
                <RowText
                  title={r.title ?? lastSegment(r.path)}
                  sub={[r.relation, r.type ? r.type.split('/').join(' / ') : null].filter(Boolean).join(' · ')}
                />
                <Chevron />
              </Row>
            ))}
          </List>
        </>
      ) : null}
      {e.artifacts.length ? (
        <>
          <Sect>Artifacts</Sect>
          <List>
            {e.artifacts.map((a, i) => (
              <Row key={a.path} first={i === 0}>
                <RowText title={a.path} sub={a.kind} />
              </Row>
            ))}
          </List>
        </>
      ) : null}
    </View>
  );
}
