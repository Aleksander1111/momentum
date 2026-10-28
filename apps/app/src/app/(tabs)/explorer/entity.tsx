import { ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme, useWide } from '../../../ui/theme';
import { useBack } from '../../../ui/parts';
import { EntityCard, EntityView } from '../../../ui/EntityView';
import { snapshot } from '../../../lib/snapshot';

/**
 * One entity opened from the Explorer: the card as the feed shows it, its project logo the way back to where it was
 * opened from; still in an export
 */
export default function Entity() {
  useTheme();
  const wide = useWide();
  const { ws, path } = useLocalSearchParams<{ ws: string; path: string }>();
  const back = useBack('Explorer', '/explorer');
  const open = (p: string) => router.push({ pathname: '/explorer/entity', params: { ws, path: p } });
  if (snapshot)
    return (
      <ScrollView
        contentContainerStyle={
          wide
            ? { maxWidth: 860, paddingVertical: 28, paddingHorizontal: 40 }
            : { paddingTop: 12, paddingHorizontal: 16, paddingBottom: 24 }
        }
      >
        {ws && path ? <EntityView ws={ws} path={path} onOpen={open} onProject={back.onPress} /> : null}
      </ScrollView>
    );
  return ws && path ? (
    <EntityCard
      key={`${ws}:${path}`}
      ws={ws}
      path={path}
      onOpen={open}
      // The card reacted to has left: back to where it was opened from
      onReacted={back.onPress}
      onProject={back.onPress}
    />
  ) : null;
}
