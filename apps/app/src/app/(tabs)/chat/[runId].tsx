import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useBack } from '../../../ui/parts';
import { Conversation } from '../../../ui/Conversation';
import { useTheme } from '../../../ui/theme';

export default function Chat() {
  useTheme();
  const { runId } = useLocalSearchParams<{ runId: string }>();
  const back = useBack('Sessions', '/chat');
  return (
    <View style={{ flex: 1, paddingTop: 12, paddingHorizontal: 16 }}>
      {runId ? <Conversation key={runId} runId={runId} back={back} /> : null}
    </View>
  );
}
