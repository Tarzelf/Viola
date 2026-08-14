import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatItemLabel, formatPrice } from '@viola/core';
import { api, ApiError, baseUrl, type LookDetail } from '@/api';
import { LookCard } from '@/components/look-card';
import { BloomButton } from '@/components/bloom-button';
import { ShareRow } from '@/components/share-row';
import { formatCount } from '@/format';
import { theme, typeStyle } from '@/theme';

const REPORT_REASONS = [
  { id: 'nudity', label: 'Nudity or sexual content' },
  { id: 'harassment', label: 'Harassment or bullying' },
  { id: 'violence', label: 'Violence or hate' },
  { id: 'impersonation', label: 'Impersonation' },
  { id: 'spam', label: 'Spam' },
  { id: 'other', label: 'Something else' },
] as const;

export default function LookScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [look, setLook] = useState<LookDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const result = await api.look(slug);
        if (!cancelled) setLook(result.look);
        // Deduped server-side within a rolling window, so firing on every
        // open is safe and keeps the count honest.
        void api.view(slug, 'app_feed').catch(() => {});
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const report = useCallback(() => {
    if (!look) return;

    // App Store guideline 1.2 requires reporting AND blocking to be reachable
    // from the content itself, not buried in settings.
    Alert.alert('This look', undefined, [
      {
        text: 'Report',
        onPress: () =>
          Alert.alert('Why are you reporting this?', undefined, [
            ...REPORT_REASONS.map((reason) => ({
              text: reason.label,
              onPress: () => {
                void api.report(look.id, reason.id).catch(() => {});
                Alert.alert('Thanks for telling us', 'A person reviews every report.');
              },
            })),
            { text: 'Cancel', style: 'cancel' as const },
          ]),
      },
      {
        text: `Block @${look.handle}`,
        style: 'destructive',
        onPress: () => {
          void api
            .block(look.handle)
            .then(() => router.back())
            .catch((error: unknown) => {
              if (error instanceof ApiError && error.status === 401) router.push('/signin');
            });
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [look, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.color.ink, justifyContent: 'center' }}>
        <ActivityIndicator color={theme.color.viola} />
      </View>
    );
  }

  if (!look) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.color.ink,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ ...typeStyle('displayMd'), color: '#fff' }}>Nothing here</Text>
      </View>
    );
  }

  const cardWidth = width - 32;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.color.ink }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40 }}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 16,
          marginBottom: 14,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ color: theme.color.textSecondary, fontSize: 20 }}>‹</Text>
        </Pressable>

        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            backgroundColor: theme.color.violaSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ ...typeStyle('bodySm'), color: theme.color.viola }}>
            {look.handle.slice(0, 1).toUpperCase()}
          </Text>
        </View>

        <Text style={{ ...typeStyle('bodySm'), color: theme.color.textSecondary, flex: 1 }}>
          <Text style={{ color: '#fff', fontFamily: 'Geist Sans SemiBold' }}>@{look.handle}</Text>{' '}
          wants you to rate this fit
        </Text>

        <Pressable onPress={report} hitSlop={12} accessibilityLabel="More options">
          <Text style={{ color: theme.color.textTertiary, fontSize: 18 }}>···</Text>
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: 16 }}>
        <LookCard look={look} width={cardWidth} />

        {look.caption && (
          <Text style={{ ...typeStyle('body'), color: theme.color.textSecondary, marginTop: 14 }}>
            {look.caption}
          </Text>
        )}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 16,
          }}
        >
          <BloomButton
            slug={look.slug}
            initialCount={look.bloomCount}
            initialBloomed={look.bloomedByViewer}
            large
          />
          <Text style={{ ...typeStyle('caption'), color: theme.color.textTertiary }}>
            {formatCount(look.viewCount)} views
          </Text>
        </View>

        <ShareRow slug={look.slug} archetype={look.archetypeName} score={look.score} />

        {look.items.length > 0 && (
          <View style={{ marginTop: 32 }}>
            <Text
              style={{
                ...typeStyle('itemLabel'),
                color: theme.color.textTertiary,
                marginBottom: 14,
              }}
            >
              SHOP THE LOOK
            </Text>

            <View style={{ gap: 10 }}>
              {look.items.map((item) => (
                <ShopRow key={item.id} item={item} slug={look.slug} />
              ))}
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function ShopRow({ item, slug }: { item: LookDetail['items'][number]; slug: string }) {
  const label = formatItemLabel(item);
  const shoppable = Boolean(item.merchantUrl);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: 12,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.color.hairline,
        backgroundColor: theme.color.surface,
      }}
    >
      <View
        style={{
          width: 54,
          height: 54,
          borderRadius: theme.radius.md,
          backgroundColor: 'rgba(255,255,255,0.04)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {item.imagePath && (
          <Image
            source={{ uri: api.mediaUrl(item.imagePath) }}
            style={{ width: 42, height: 42 }}
            contentFit="contain"
          />
        )}
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        {label.brand.length > 0 && (
          <Text numberOfLines={1} style={{ ...typeStyle('itemLabel'), color: '#fff' }}>
            {label.brand}
          </Text>
        )}
        <Text
          numberOfLines={1}
          style={{ ...typeStyle('itemLabelSub'), color: theme.color.textSecondary }}
        >
          {label.name}
        </Text>
        {item.source && (
          <Text style={{ ...typeStyle('caption'), color: theme.color.textTertiary, marginTop: 3 }}>
            at {item.source}
          </Text>
        )}
      </View>

      {item.priceCents != null && (
        <Text style={{ ...typeStyle('stat'), color: '#fff' }}>
          {formatPrice(item.priceCents, item.currency)}
        </Text>
      )}

      {shoppable ? (
        <Pressable
          onPress={() => {
            // Through our own redirector, so the affiliate network stays
            // swappable and the click is attributed to this exact item.
            void Linking.openURL(`${baseUrl()}/go/${item.id}?l=${slug}`);
          }}
          style={({ pressed }) => ({
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: theme.radius.pill,
            backgroundColor: '#fff',
            transform: [{ scale: pressed ? 0.96 : 1 }],
          })}
        >
          <Text
            style={{
              ...typeStyle('bodySm'),
              fontFamily: 'Geist Sans SemiBold',
              color: theme.color.ink,
            }}
          >
            Shop
          </Text>
        </Pressable>
      ) : (
        <Text style={{ ...typeStyle('caption'), color: theme.color.textTertiary }}>Not found</Text>
      )}
    </View>
  );
}
