import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '@/theme';

/**
 * The centre tab is a launcher, not a destination.
 *
 * Posting opens as a modal so the reveal owns the whole screen — it is the
 * moment the product sells itself and should not share space with a tab bar.
 */
export default function PostTab() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/new');
  }, [router]);

  return <View style={{ flex: 1, backgroundColor: theme.color.ink }} />;
}
