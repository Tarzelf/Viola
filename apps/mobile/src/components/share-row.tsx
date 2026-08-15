import { Alert, Linking, Pressable, Share, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { api } from '@/api';
import { theme, typeStyle } from '@/theme';

/**
 * Sharing, natively.
 *
 * Messages gets a dedicated button rather than hiding behind the system sheet.
 * The iOS share sheet is materially higher friction than Android's, and burying
 * the highest-intent channel inside it costs conversions — every step between
 * the impulse and the send loses a meaningful share of them.
 *
 * The link and the message text are both prepared before the tap. Nothing is
 * generated on press, because a spinner is a step.
 */
export function ShareRow({
  slug,
  archetype,
  score,
}: {
  slug: string;
  archetype: string | null;
  score: number | null;
}) {
  const url = api.shareUrl(slug);
  const message =
    archetype && score !== null
      ? `rate my fit 👀 ${archetype} ${score} — ${url}`
      : `rate my fit 👀 ${url}`;

  function record(channel: string) {
    void api.recordShare(slug, channel).catch(() => {});
    void api.event('share_opened', { lookId: slug, entry: 'look_page' }).catch(() => {});
  }

  async function sendToMessages() {
    void Haptics.selectionAsync();
    record('messages');

    const target = `sms:&body=${encodeURIComponent(message)}`;
    const supported = await Linking.canOpenURL(target).catch(() => false);

    if (supported) {
      await Linking.openURL(target);
      return;
    }
    // Simulators have no Messages app; fall back rather than dead-ending.
    await openSystemSheet();
  }

  async function openSystemSheet() {
    record('system_sheet');
    try {
      await Share.share({ message, url });
    } catch {
      Alert.alert('Could not open the share sheet');
    }
  }

  return (
    <View style={{ flexDirection: 'row', gap: 8, marginTop: 18 }}>
      <Pressable
        onPress={sendToMessages}
        style={({ pressed }) => ({
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 14,
          borderRadius: theme.radius.pill,
          backgroundColor: '#fff',
          transform: [{ scale: pressed ? 0.98 : 1 }],
        })}
      >
        <Text style={{ ...typeStyle('titleSm'), color: theme.color.ink }}>Send to a friend</Text>
      </Pressable>

      <Pressable
        onPress={openSystemSheet}
        accessibilityLabel="Share"
        style={({ pressed }) => ({
          width: 50,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: theme.radius.pill,
          borderWidth: 1,
          borderColor: theme.color.hairline,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        })}
      >
        <Text style={{ color: theme.color.textSecondary, fontSize: 17 }}>↗</Text>
      </Pressable>
    </View>
  );
}
