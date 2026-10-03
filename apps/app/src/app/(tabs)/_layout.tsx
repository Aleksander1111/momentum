import { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Redirect } from 'expo-router';
import { Tabs, type BottomTabBarProps } from 'expo-router/tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getToken } from '../../lib/token';
import { useChatContext } from '../../lib/context';
import { C, useTheme, useWide } from '../../ui/theme';
import { T } from '../../ui/Text';
import { Icon } from '../../ui/icons';

const TABS = [
  { name: 'feed', label: 'Feed' },
  { name: 'explorer', label: 'Explorer' },
  { name: 'chat', label: 'Chat' },
  { name: 'metrics', label: 'Metrics' },
  { name: 'settings', label: 'Settings' },
] as const;

function Nav({ state, navigation, wide }: BottomTabBarProps & { wide: boolean }) {
  const insets = useSafeAreaInsets();
  // Parts of cards waiting to go with the next chat message
  const waiting = useChatContext().length;
  return (
    <View
      style={
        wide
          ? {
              width: 92,
              backgroundColor: C.surface,
              borderRightWidth: 1,
              borderRightColor: C.line,
              paddingVertical: 28,
              paddingTop: 28 + insets.top,
              alignItems: 'center',
              gap: 22,
            }
          : {
              flexDirection: 'row',
              justifyContent: 'space-around',
              alignItems: 'center',
              backgroundColor: C.surface,
              borderTopWidth: 1,
              borderTopColor: C.line,
              paddingTop: 10,
              paddingHorizontal: 6,
              paddingBottom: 16 + insets.bottom,
            }
      }
    >
      {state.routes.map((route, index) => {
        const tab = TABS.find((t) => t.name === route.name);
        if (!tab) return null;
        const on = state.index === index;
        const color = on ? C.accent : C.muted;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!on && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };
        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={{ alignItems: 'center', gap: 4 }}
          >
            <View>
              <Icon name={tab.name} size={wide ? 26 : 24} color={color} />
              {tab.name === 'chat' && waiting > 0 ? (
                <View
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -8,
                    minWidth: 16,
                    height: 16,
                    borderRadius: 8,
                    paddingHorizontal: 4,
                    backgroundColor: C.accent,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <T style={{ color: C.surface, fontSize: 10.5, fontWeight: '700' }}>{waiting}</T>
                </View>
              ) : null}
            </View>
            <T style={{ color, fontSize: wide ? 12 : 11.5, fontWeight: on ? '700' : '400' }}>{tab.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  useTheme();
  const wide = useWide();
  const insets = useSafeAreaInsets();
  const [auth, setAuth] = useState<'unknown' | 'yes' | 'no'>(Platform.OS === 'web' ? 'yes' : 'unknown');

  useEffect(() => {
    if (Platform.OS === 'web') return;
    void getToken().then((t) => setAuth(t ? 'yes' : 'no'));
  }, []);

  if (auth === 'unknown') return null;
  if (auth === 'no') return <Redirect href="/session" />;

  return (
    <Tabs
      tabBar={(props) => <Nav {...props} wide={wide} />}
      screenOptions={{
        headerShown: false,
        tabBarPosition: wide ? 'left' : 'bottom',
        sceneStyle: { backgroundColor: C.screen, paddingTop: wide ? 0 : insets.top },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} />
      ))}
    </Tabs>
  );
}
