import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import type { FeedItem } from '@/api';
import { api } from '@/api';
import { formatCount } from '@/format';
import { theme, typeStyle } from '@/theme';

/**
 * Horizontal snap runway for featured looks — CollectUI slider energy on
 * native. Same job as the web LookSlider: one curated strip above the feed.
 */
export function LookSlider({
  looks,
  onOpen,
  title = 'This week',
}: {
  looks: FeedItem[];
  onOpen: (slug: string) => void;
  title?: string;
}) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - 48, 340);

  if (looks.length === 0) return null;

  return (
    <View style={{ marginBottom: 22 }}>
      <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
        <Text style={{ ...typeStyle('itemLabel'), color: theme.color.gold, letterSpacing: 2 }}>
          ✦ {title}
        </Text>
        <Text style={{ ...typeStyle('displayMd'), color: '#fff', marginTop: 4 }}>
          Looks earning the room
        </Text>
      </View>

      <ScrollView
        horizontal
        pagingEnabled={false}
        decelerationRate="fast"
        snapToInterval={cardWidth + 12}
        snapToAlignment="start"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
      >
        {looks.map((look) => (
          <Pressable
            key={look.id}
            onPress={() => onOpen(look.slug)}
            style={{
              width: cardWidth,
              height: cardWidth * 1.25,
              borderRadius: theme.radius.xl,
              overflow: 'hidden',
              backgroundColor: theme.color.surface,
            }}
          >
            <Image
              source={{ uri: api.mediaUrl(look.photoPath) }}
              style={{ position: 'absolute', width: cardWidth, height: cardWidth * 1.25 }}
              contentFit="cover"
              transition={200}
            />
            <LinearGradient
              colors={['transparent', 'rgba(11,10,15,0.88)']}
              style={{
                position: 'absolute',
                bottom: 0,
                width: cardWidth,
                height: cardWidth * 0.55,
              }}
            />
            <View style={{ position: 'absolute', left: 14, right: 14, bottom: 14 }}>
              <Text style={{ ...typeStyle('bodySm'), color: 'rgba(255,255,255,0.7)' }}>
                @{look.handle}
              </Text>
              {look.archetypeName && (
                <Text
                  style={{
                    ...typeStyle('displayMd'),
                    color: '#fff',
                    marginTop: 4,
                    fontSize: 24,
                  }}
                  numberOfLines={1}
                >
                  {look.archetypeName}
                  {look.score != null ? (
                    <Text style={{ ...typeStyle('stat'), color: 'rgba(255,255,255,0.6)' }}>
                      {' '}
                      {look.score}
                    </Text>
                  ) : null}
                </Text>
              )}
              <Text
                style={{
                  ...typeStyle('caption'),
                  color: 'rgba(255,255,255,0.55)',
                  marginTop: 8,
                }}
              >
                {look.itemCount} pcs · {formatCount(look.bloomCount)} blooms ·{' '}
                {formatCount(look.viewCount)} views
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
