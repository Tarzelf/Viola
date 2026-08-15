import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View } from 'react-native';
import { FONTS, theme } from '@/theme';

/**
 * Root layout.
 *
 * Fonts are bundled rather than fetched. The share cards this app produces are
 * rendered server-side with the same faces, and a card whose type does not
 * match the app it came from is a small inconsistency that reads as
 * carelessness.
 */
export default function RootLayout() {
  const [fontsLoaded] = useFonts(FONTS);

  if (!fontsLoaded) {
    // A blank canvas in the brand colour rather than a spinner — the app should
    // never flash unstyled text.
    return <View style={{ flex: 1, backgroundColor: theme.color.ink }} />;
  }

  return (
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
        <Stack.Screen name="fold" />
        <Stack.Screen
          name="new"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="signin" options={{ presentation: 'modal' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
