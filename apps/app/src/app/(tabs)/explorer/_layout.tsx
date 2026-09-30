import { Stack } from 'expo-router';
import { C, useTheme } from '../../../ui/theme';

export default function Layout() {
  useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.screen } }} />;
}
