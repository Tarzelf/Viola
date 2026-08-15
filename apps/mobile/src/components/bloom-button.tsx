import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { api } from '@/api';
import { theme, typeStyle } from '@/theme';
import { formatCount } from '@/format';

/**
 * Bloom, with haptics.
 *
 * The only reaction in the product — no downvote, and there will not be one.
 * On iOS the tap lands with a light impact: the physical confirmation is a
 * large part of why the gesture feels good, and it is the one thing the web
 * version genuinely cannot match.
 *
 * Optimistic, because the burst has to happen on the tap rather than after a
 * round trip.
 */
export function BloomButton({
  slug,
  initialCount,
  initialBloomed,
  large = false,
}: {
  slug: string;
  initialCount: number;
  initialBloomed: boolean;
  large?: boolean;
}) {
  const [bloomed, setBloomed] = useState(initialBloomed);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  async function bloom() {
    if (bloomed || busy) return;

    setBusy(true);
    setBloomed(true);
    setCount((c) => c + 1);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const result = await api.bloom(slug);
      setCount(result.bloomCount);
    } catch {
      // Roll back rather than leaving a lie on screen.
      setBloomed(false);
      setCount((c) => Math.max(0, c - 1));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Pressable
      onPress={bloom}
      disabled={bloomed}
      accessibilityRole="button"
      accessibilityLabel={bloomed ? `Bloomed, ${count} blooms` : `Bloom this look, ${count} blooms`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: large ? 18 : 13,
        paddingVertical: large ? 12 : 8,
        borderRadius: theme.radius.pill,
        borderWidth: 1,
        borderColor: bloomed ? 'transparent' : theme.color.hairline,
        backgroundColor: bloomed ? theme.color.viola : 'rgba(255,255,255,0.04)',
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      <Petal filled={bloomed} size={large ? 17 : 14} />
      <Text
        style={{
          ...typeStyle('stat'),
          fontSize: large ? 15 : 13,
          color: bloomed ? '#fff' : theme.color.textSecondary,
        }}
      >
        {formatCount(count)}
      </Text>
    </Pressable>
  );
}

/** A petal, drawn with views so no SVG dependency is needed. */
function Petal({ filled, size }: { filled: boolean; size: number }) {
  const colour = filled ? '#fff' : theme.color.textSecondary;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: size * 0.72,
          height: size * 0.72,
          borderRadius: size * 0.36,
          borderTopLeftRadius: 2,
          borderWidth: filled ? 0 : 1.6,
          borderColor: colour,
          backgroundColor: filled ? colour : 'transparent',
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}
