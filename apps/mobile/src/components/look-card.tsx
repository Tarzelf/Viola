import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, Text, View, type ViewStyle } from 'react-native';
import { formatItemLabel, formatPrice } from '@viola/core';
import { api, type LookDetail } from '@/api';
import { theme, typeStyle } from '@/theme';

/**
 * The annotated look card, natively.
 *
 * Positions come from the same layout engine output the web card and the
 * server-rendered share card use, expressed as percentages of the container.
 * Nothing is recomputed on the device — the placement a user sees here is
 * byte-identical to the one printed on the card they share.
 */
export function LookCard({ look, width }: { look: LookDetail; width: number }) {
  const height = width * 1.25; // 4:5, the aspect a mirror selfie wants
  const layout = look.layout;

  return (
    <View style={{ width, height, borderRadius: theme.radius.xl, overflow: 'hidden' }}>
      <Image
        source={{ uri: api.mediaUrl(look.photoPath) }}
        style={{ position: 'absolute', width, height }}
        contentFit="cover"
        transition={220}
      />

      <View
        style={{
          position: 'absolute',
          width,
          height,
          backgroundColor: theme.color.scrim,
        }}
      />
      <LinearGradient
        colors={['transparent', 'rgba(11,10,15,0.88)']}
        style={{ position: 'absolute', bottom: 0, width, height: height * 0.42 }}
      />

      {layout?.slots.map((slot) => {
        const item = look.items[slot.itemIndex];
        if (!item) return null;
        return <Annotation key={item.id} item={item} slot={slot} width={width} height={height} />;
      })}

      {look.score !== null && look.archetypeName && (
        <View
          style={{
            position: 'absolute',
            bottom: height * 0.13,
            width,
            alignItems: 'center',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              gap: 8,
              backgroundColor: theme.color.viola,
              paddingHorizontal: 18,
              paddingVertical: 9,
              borderRadius: theme.radius.pill,
            }}
          >
            <Text style={{ ...typeStyle('displayMd'), fontSize: 19, color: '#fff' }}>
              {look.archetypeName}
            </Text>
            <Text style={{ ...typeStyle('stat'), color: 'rgba(255,255,255,0.72)' }}>
              {look.score}
            </Text>
          </View>
        </View>
      )}

      <View style={{ position: 'absolute', bottom: height * 0.05, width, alignItems: 'center' }}>
        <Text style={{ ...typeStyle('caption'), color: 'rgba(255,255,255,0.45)' }}>
          viola.app/@{look.handle}
        </Text>
      </View>
    </View>
  );
}

function Annotation({
  item,
  slot,
  width,
  height,
}: {
  item: LookDetail['items'][number];
  slot: NonNullable<LookDetail['layout']>['slots'][number];
  width: number;
  height: number;
}) {
  const label = formatItemLabel(item);

  const left = slot.rect.x0 * width;
  const top = slot.rect.y0 * height;
  const boxWidth = (slot.rect.x1 - slot.rect.x0) * width;
  const boxHeight = (slot.rect.y1 - slot.rect.y0) * height;

  // L-shaped connector: out from the card, then down (or up) to the garment.
  const startX = slot.side === 'left' ? slot.rect.x1 : slot.rect.x0;
  const midY = (slot.rect.y0 + slot.rect.y1) / 2;

  const runStyle: ViewStyle = {
    position: 'absolute',
    left: Math.min(startX, slot.anchor.x) * width,
    top: midY * height,
    width: Math.abs(slot.anchor.x - startX) * width,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.55)',
  };

  const dropStyle: ViewStyle = {
    position: 'absolute',
    left: slot.anchor.x * width,
    top: Math.min(midY, slot.anchor.y) * height,
    width: 1,
    height: Math.abs(slot.anchor.y - midY) * height,
    backgroundColor: 'rgba(255,255,255,0.55)',
  };

  return (
    <>
      <View style={runStyle} />
      <View style={dropStyle} />
      <View
        style={{
          position: 'absolute',
          left: slot.anchor.x * width - 4,
          top: slot.anchor.y * height - 4,
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: theme.color.viola,
        }}
      />

      <View
        style={{
          position: 'absolute',
          left,
          top,
          width: boxWidth,
          // Deliberately no fixed height. A hard height with overflow:hidden
          // clipped long names mid-word ("STRUCTURED ED-") rather than letting
          // them ellipsise, which looks like a rendering fault.
          maxHeight: boxHeight,
          alignItems: 'center',
        }}
      >
        {item.imagePath && (
          <Image
            source={{ uri: api.mediaUrl(item.imagePath) }}
            style={{ width: boxWidth * 0.7, height: boxHeight * 0.55, marginBottom: 5 }}
            contentFit="contain"
            transition={180}
          />
        )}
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{ ...typeStyle('itemLabel'), color: '#fff', textAlign: 'center' }}
        >
          {label.brand}
        </Text>
        <Text
          numberOfLines={2}
          ellipsizeMode="tail"
          style={{
            ...typeStyle('itemLabelSub'),
            color: 'rgba(255,255,255,0.78)',
            textAlign: 'center',
          }}
        >
          {label.name}
        </Text>
        {item.priceCents != null && (
          <Text
            style={{
              ...typeStyle('caption'),
              fontFamily: 'Geist Mono',
              color: 'rgba(255,255,255,0.55)',
              marginTop: 2,
            }}
          >
            {formatPrice(item.priceCents, item.currency)}
          </Text>
        )}
      </View>
    </>
  );
}

/** Compact card for the feed list. */
export function FeedCard({
  look,
  width,
  onPress,
}: {
  look: {
    slug: string;
    photoPath: string;
    score: number | null;
    archetypeName: string | null;
    handle: string;
    itemCount: number;
  };
  width: number;
  onPress: () => void;
}) {
  const height = width * 1.25;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
      <View style={{ width, height, borderRadius: theme.radius.xl, overflow: 'hidden' }}>
        <Image
          source={{ uri: api.mediaUrl(look.photoPath) }}
          style={{ position: 'absolute', width, height }}
          contentFit="cover"
          transition={220}
        />
        <LinearGradient
          colors={['transparent', 'rgba(11,10,15,0.9)']}
          style={{ position: 'absolute', bottom: 0, width, height: height * 0.5 }}
        />

        {look.score !== null && look.archetypeName && (
          <View
            style={{
              position: 'absolute',
              bottom: 12,
              left: 12,
              flexDirection: 'row',
              alignItems: 'baseline',
              gap: 7,
              backgroundColor: theme.color.viola,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: theme.radius.pill,
            }}
          >
            <Text style={{ ...typeStyle('displayMd'), fontSize: 15, color: '#fff' }}>
              {look.archetypeName}
            </Text>
            <Text style={{ ...typeStyle('stat'), fontSize: 12, color: 'rgba(255,255,255,0.72)' }}>
              {look.score}
            </Text>
          </View>
        )}

        {look.itemCount > 0 && (
          <View
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: theme.radius.pill,
              backgroundColor: 'rgba(0,0,0,0.35)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.15)',
            }}
          >
            <Text
              style={{ ...typeStyle('itemLabel'), fontSize: 10, color: 'rgba(255,255,255,0.85)' }}
            >
              {look.itemCount} PIECES
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}
