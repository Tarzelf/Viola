import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Platform } from 'react-native';
import { SuperwallProvider } from 'expo-superwall';
import { FONTS, theme } from '@/theme';

/**
 * Root layout.
 *
 * Superwall wraps the tree on iOS so Plus purchases go through StoreKit.
 * Web/Android still boot without a key — the provider no-ops when keys are empty.
 */
const SUPERWALL_IOS = process.env.EXPO_PUBLIC_SUPERWALL_API_KEY ?? '';

export default function RootLayout() {
  const [fontsLoaded] = useFonts(FONTS);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: theme.color.ink }} />;
  }

  const tree = (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.color.ink },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="l/[slug]" />
        <Stack.Screen
          name="new"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="signin" options={{ presentation: 'modal' }} />
        <Stack.Screen name="plus" options={{ presentation: 'modal' }} />
      </Stack>
    </SafeAreaProvider>
  );

  // Superwall requires a native build; skip wrapping when no key (Expo web / CI).
  if (!SUPERWALL_IOS || Platform.OS === 'web') {
    return tree;
  }

  return (
    <SuperwallProvider apiKeys={{ ios: SUPERWALL_IOS }}>
      {tree}
    </SuperwallProvider>
  );
}
