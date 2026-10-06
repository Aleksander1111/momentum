import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Back, useBack } from '../../../ui/parts';
import { Conversation } from '../../../ui/Conversation';
import { useTheme } from '../../../ui/theme';

export default function Chat() {
  useTheme();
  const { runId } = useLocalSearchParams<{ runId: string }>();
  const back = useBack('Chats', '/chat');
  return (
    <View style={{ flex: 1, paddingTop: 12, paddingHorizontal: 16, paddingBottom: 24 }}>
      <Back {...back} />
      {runId ? <Conversation key={runId} runId={runId} /> : null}
    </View>
  );
}
