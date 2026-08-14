import { View } from 'react-native';
import { theme } from '@/theme';

/**
 * Placeholder for the centre tab.
 *
 * Never actually rendered: the tab bar intercepts the press and presents /new
 * as a modal instead, so the reveal owns the whole screen. The file exists
 * because expo-router derives the tab from it.
 */
export default function PostTab() {
  return <View style={{ flex: 1, backgroundColor: theme.color.ink }} />;
}
