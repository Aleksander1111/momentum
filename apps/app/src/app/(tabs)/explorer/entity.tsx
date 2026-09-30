import { ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme, useWide } from '../../../ui/theme';
import { Back } from '../../../ui/parts';
import { EntityView } from '../../../ui/EntityView';

export default function Entity() {
  useTheme();
  const wide = useWide();
  const { ws, path } = useLocalSearchParams<{ ws: string; path: string }>();
  return (
    <ScrollView
      contentContainerStyle={
        wide
          ? { maxWidth: 860, paddingVertical: 28, paddingHorizontal: 40 }
          : { paddingTop: 12, paddingHorizontal: 16, paddingBottom: 24 }
      }
    >
      <Back
        label="Explorer"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/explorer'))}
      />
      {ws && path ? (
        <EntityView
          ws={ws}
          path={path}
          onOpen={(p) => router.push({ pathname: '/explorer/entity', params: { ws, path: p } })}
        />
      ) : null}
    </ScrollView>
  );
}
