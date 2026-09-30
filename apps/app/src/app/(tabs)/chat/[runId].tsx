import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Back } from '../../../ui/parts';
import { Conversation } from '../../../ui/Conversation';
import { useTheme } from '../../../ui/theme';

export default function Chat() {
  useTheme();
  const { runId } = useLocalSearchParams<{ runId: string }>();
  return (
    <View style={{ flex: 1, paddingTop: 12, paddingHorizontal: 16, paddingBottom: 24 }}>
      <Back label="Chats" onPress={() => (router.canGoBack() ? router.back() : router.replace('/chat'))} />
      {runId ? <Conversation key={runId} runId={runId} /> : null}
    </View>
  );
}
