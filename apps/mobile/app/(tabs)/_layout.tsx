import { Tabs, useRouter } from 'expo-router';
import { Platform, Text, View, type ColorValue } from 'react-native';
import * as Haptics from 'expo-haptics';
import { theme, typeStyle } from '@/theme';

/**
 * Tab bar.
 *
 * Three destinations and a prominent post button. Deliberately not five —
 * every extra tab is a decision the user has to make before doing the thing
 * they opened the app for.
 */
export default function TabsLayout() {
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(11,10,15,0.94)',
          borderTopColor: theme.color.hairline,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: theme.color.textTertiary,
        tabBarLabelStyle: { ...typeStyle('caption'), marginTop: 2 },
      }}
      screenListeners={{
        tabPress: () => {
          void Haptics.selectionAsync();
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color }) => <TabGlyph color={color} glyph="◍" />,
        }}
      />
      <Tabs.Screen
        name="post"
        options={{
          title: '',
          tabBarIcon: () => <PostButton />,
        }}
        listeners={{
          tabPress: (event) => {
            // Present the composer as a modal instead of navigating to a tab.
            // Routing to a tab that immediately redirects left the navigator
            // with nothing to go back to, so Close warned about an unhandled
            // GO_BACK and the tab bar flickered on the way out.
            event.preventDefault();
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/new');
          },
        }}
      />
      <Tabs.Screen
        name="vaults"
        options={{
          title: 'Vaults',
          tabBarIcon: ({ color }) => <TabGlyph color={color} glyph="◈" />,
        }}
      />
    </Tabs>
  );
}

function TabGlyph({ color, glyph }: { color: ColorValue; glyph: string }) {
  return <Text style={{ color, fontSize: 18, lineHeight: 22 }}>{glyph}</Text>;
}

function PostButton() {
  return (
    <View
      style={{
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: theme.color.viola,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: -18,
        shadowColor: theme.color.viola,
        shadowOpacity: 0.5,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
      }}
    >
      <Text style={{ color: '#fff', fontSize: 26, lineHeight: 30, marginTop: -2 }}>+</Text>
    </View>
  );
}
