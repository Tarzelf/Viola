import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, type FeedItem } from '@/api';
import { FeedCard } from '@/components/look-card';
import { BloomButton } from '@/components/bloom-button';
import { formatCount } from '@/format';
import { theme, typeStyle } from '@/theme';

type Tab = 'for-you' | 'fresh' | 'top';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'for-you', label: 'For you' },
  { id: 'fresh', label: 'Fresh' },
  { id: 'top', label: 'Top of the week' },
];

export default function FeedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [tab, setTab] = useState<Tab>('for-you');
  const [looks, setLooks] = useState<FeedItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (which: Tab) => {
    try {
      setError(null);
      const result = await api.feed(which);
      setLooks(result.looks);
    } catch {
      // Surfaced rather than swallowed: a silent empty feed is
      // indistinguishable from "nobody has posted", which is a much worse
      // thing for a new user to conclude.
      setError('Could not reach Viola. Pull to try again.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(tab);
    }, [load, tab]),
  );

  const cardWidth = width - 32;

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.ink, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
        <Text style={{ ...typeStyle('displayLg'), color: '#fff' }}>
          Viola<Text style={{ color: theme.color.violaText }}>.</Text>
        </Text>

        <View style={{ flexDirection: 'row', gap: 6, marginTop: 12 }}>
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <Pressable
                key={t.id}
                onPress={() => {
                  setTab(t.id);
                  void load(t.id);
                }}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: theme.radius.pill,
                  backgroundColor: active ? '#fff' : 'transparent',
                }}
              >
                <Text
                  style={{
                    ...typeStyle('bodySm'),
                    fontFamily: 'Geist Sans Medium',
                    color: active ? theme.color.ink : theme.color.textSecondary,
                  }}
                >
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <FlatList
        data={looks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 26 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={theme.color.viola}
            onRefresh={async () => {
              setRefreshing(true);
              await load(tab);
              setRefreshing(false);
            }}
          />
        }
        ListEmptyComponent={
          <View style={{ paddingTop: 80, alignItems: 'center' }}>
            <Text style={{ ...typeStyle('displayMd'), color: '#fff' }}>
              {error ? 'Nothing loaded' : 'Nothing here yet'}
            </Text>
            <Text
              style={{
                ...typeStyle('bodySm'),
                color: theme.color.textSecondary,
                marginTop: 8,
                textAlign: 'center',
                paddingHorizontal: 40,
              }}
            >
              {error ?? 'Post a fit and Viola will name every piece.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View>
            <FeedCard
              look={item}
              width={cardWidth}
              onPress={() => router.push(`/l/${item.slug}`)}
            />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 10,
              }}
            >
              <Text style={{ ...typeStyle('bodySm'), color: theme.color.textSecondary }}>
                @{item.handle}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ ...typeStyle('caption'), color: theme.color.textTertiary }}>
                  {formatCount(item.viewCount)} views
                </Text>
                <BloomButton
                  slug={item.slug}
                  initialCount={item.bloomCount}
                  initialBloomed={item.bloomedByViewer}
                />
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}
