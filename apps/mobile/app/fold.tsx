import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  REST_ANGLES,
  projectLattice,
  returnPathsFor,
  toMapPoint,
  type FoldLattice,
  type FoldMode,
} from '@viola/core';
import { api } from '@/api';
import { theme, typeStyle } from '@/theme';

const MODES: Array<{ id: FoldMode; label: string }> = [
  { id: 'moments', label: 'Moments' },
  { id: 'scenarios', label: 'Scenarios' },
  { id: 'return', label: 'Return' },
];

export default function FoldScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { focus } = useLocalSearchParams<{ focus?: string }>();

  const [lattice, setLattice] = useState<FoldLattice | null>(null);
  const [mode, setMode] = useState<FoldMode>(focus ? 'return' : 'moments');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void api.fold().then((result) => {
        if (cancelled) return;
        setLattice(result.lattice);
        const focused = result.lattice.moments.find((m) => m.slug === focus);
        if (focused) {
          setSelectedId(focused.id);
          setMode('return');
        }
        void api.event('fold_opened', {
          momentCount: result.lattice.moments.length,
          focusSlug: focus,
        });
      });
      return () => {
        cancelled = true;
      };
    }, [focus]),
  );

  const selected = lattice?.moments.find((m) => m.id === selectedId) ?? null;
  const returns = useMemo(
    () => (lattice && selectedId ? returnPathsFor(lattice, selectedId) : []),
    [lattice, selectedId],
  );
  const projected = useMemo(
    () => (lattice ? projectLattice(lattice, REST_ANGLES) : null),
    [lattice],
  );

  const mapH = height - insets.top - insets.bottom - 280;
  const mapW = width;

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.ink, paddingTop: insets.top }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingBottom: 8,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text style={{ ...typeStyle('displayMd'), color: '#fff' }}>Fold</Text>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ ...typeStyle('bodySm'), color: theme.color.textSecondary }}>Close</Text>
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
        <Text
          style={{ ...typeStyle('caption'), color: theme.color.textTertiary, letterSpacing: 2 }}
        >
          ALL AT ONCE
        </Text>
        <Text style={{ ...typeStyle('displayMd'), color: '#fff', marginTop: 4 }}>
          Every look exists at the same time.
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 16, marginBottom: 8 }}>
        {MODES.map((item) => {
          const active = mode === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => setMode(item.id)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: theme.radius.pill,
                backgroundColor: active ? '#fff' : 'transparent',
                borderWidth: active ? 0 : 1,
                borderColor: theme.color.hairline,
              }}
            >
              <Text
                style={{
                  ...typeStyle('caption'),
                  color: active ? theme.color.ink : theme.color.textSecondary,
                }}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ width: mapW, height: mapH }}>
        {projected &&
          lattice &&
          lattice.moments.map((moment) => {
            const node = projected.moments.find((m) => m.id === moment.id);
            if (!node) return null;
            const point = toMapPoint(node.position);
            const selectedCell = moment.id === selectedId;
            const size = selectedCell ? 78 : 56;
            return (
              <Pressable
                key={moment.id}
                onPress={() => setSelectedId(selectedCell ? null : moment.id)}
                style={{
                  position: 'absolute',
                  left: point.x * mapW - size / 2,
                  top: (1 - point.y) * mapH - (size * 1.25) / 2,
                  width: size,
                  height: size * 1.25,
                  borderRadius: 12,
                  overflow: 'hidden',
                  borderWidth: selectedCell ? 2 : 1,
                  borderColor: selectedCell ? theme.color.viola : theme.color.hairline,
                  opacity: 0.95,
                }}
              >
                <Image
                  source={{ uri: api.mediaUrl(moment.photoPath) }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                />
              </Pressable>
            );
          })}
      </View>

      <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16, paddingTop: 8 }}>
        {selected ? (
          <View
            style={{
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: theme.color.hairline,
              backgroundColor: theme.color.surface,
              padding: 14,
            }}
          >
            <Text style={{ ...typeStyle('displayMd'), color: '#fff' }}>
              {selected.archetypeName ?? 'A look'}
            </Text>
            <Text
              style={{ ...typeStyle('bodySm'), color: theme.color.textSecondary, marginTop: 2 }}
            >
              @{selected.handle}
              {selected.caption ? ` · ${selected.caption}` : ''}
            </Text>
            {mode === 'return' && returns.length > 0 && (
              <Text
                style={{ ...typeStyle('caption'), color: theme.color.textTertiary, marginTop: 6 }}
              >
                {returns.map((path) => path.label).join(' · ')}
              </Text>
            )}
            <Pressable
              onPress={() => router.push(`/l/${selected.slug}`)}
              style={{
                marginTop: 12,
                alignSelf: 'flex-start',
                backgroundColor: theme.color.viola,
                borderRadius: theme.radius.pill,
                paddingHorizontal: 16,
                paddingVertical: 10,
              }}
            >
              <Text
                style={{ ...typeStyle('bodySm'), color: '#fff', fontFamily: 'Geist Sans SemiBold' }}
              >
                Enter this moment
              </Text>
            </Pressable>
          </View>
        ) : (
          <Text style={{ ...typeStyle('bodySm'), color: theme.color.textSecondary }}>
            Tap a room. Energy finds the way back.
          </Text>
        )}
      </View>
    </View>
  );
}
