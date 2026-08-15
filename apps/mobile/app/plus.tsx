import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlacement } from 'expo-superwall';
import { PRICES, formatPrice } from '@viola/core';
import { theme, typeStyle } from '@/theme';

const HAS_SUPERWALL = Boolean(process.env.EXPO_PUBLIC_SUPERWALL_API_KEY);

/**
 * Viola Plus on iOS — StoreKit via Superwall.
 * Web checkout (Whop) must never be linked from here (Guideline 3.1.1).
 */
export default function PlusScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const monthly = PRICES.find((p) => p.id === 'monthly')!;
  const annual = PRICES.find((p) => p.id === 'annual')!;

  const BENEFITS = [
    ['Unlimited vaults', 'Organise by season, mood, occasion.'],
    ['Unlimited saves', 'The free plan keeps 20 pieces.'],
    ['No sponsored posts', 'A completely clean feed.'],
    ['Unlimited AI tagging', 'Post as often as you like.'],
    ['Private looks', 'Post something only you can see.'],
    ['Full score breakdown', 'Fit, colour, texture, statement, cohesion.'],
  ] as const;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.color.ink }}
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingHorizontal: 24,
        paddingBottom: 48,
      }}
    >
      <Pressable onPress={() => router.back()} hitSlop={12} style={{ alignSelf: 'flex-start' }}>
        <Text style={{ color: theme.color.textSecondary, fontSize: 15 }}>Close</Text>
      </Pressable>

      <Text style={{ ...typeStyle('itemLabel'), color: theme.color.violaText, marginTop: 22 }}>
        VIOLA PLUS
      </Text>
      <Text style={{ ...typeStyle('displayLg'), color: '#fff', marginTop: 8 }}>
        Keep everything you love
      </Text>
      <Text style={{ ...typeStyle('body'), color: theme.color.textSecondary, marginTop: 10 }}>
        Posting, blooming and sharing are free and always will be. Plus is for when one vault stops
        being enough.
      </Text>

      <View style={{ marginTop: 26, gap: 14 }}>
        {BENEFITS.map(([title, detail]) => (
          <View key={title} style={{ flexDirection: 'row', gap: 12 }}>
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: theme.color.violaSoft,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 2,
              }}
            >
              <Text style={{ color: theme.color.violaText, fontSize: 11 }}>✓</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...typeStyle('titleSm'), color: '#fff' }}>{title}</Text>
              <Text style={{ ...typeStyle('bodySm'), color: theme.color.textSecondary }}>
                {detail}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: 12, marginTop: 30 }}>
        <PlanCard
          label="Yearly"
          price={`${formatPrice(annual.perMonthCents)}/mo`}
          detail={`${formatPrice(annual.cents)} a year`}
          badge={`Save ${annual.savingsPercent}%`}
        />
        <PlanCard
          label="Monthly"
          price={`${formatPrice(monthly.cents)}/mo`}
          detail="Billed monthly"
        />
      </View>

      {HAS_SUPERWALL && Platform.OS === 'ios' ? (
        <SuperwallPurchaseButton onDone={() => router.back()} />
      ) : (
        <Pressable
          onPress={() => {
            if (Platform.OS !== 'ios') {
              Alert.alert(
                'Get Plus on the web',
                'On web, Viola Plus is sold through Whop at viola.app/plus.',
              );
              return;
            }
            Alert.alert(
              'Superwall not configured',
              'Set EXPO_PUBLIC_SUPERWALL_API_KEY and a campaign with placement "campaign_trigger".',
            );
          }}
          style={{
            marginTop: 20,
            paddingVertical: 16,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.color.viola,
            alignItems: 'center',
          }}
        >
          <Text style={{ ...typeStyle('titleSm'), color: '#fff' }}>Get Viola Plus</Text>
        </Pressable>
      )}

      <Text
        style={{
          ...typeStyle('caption'),
          color: theme.color.textTertiary,
          textAlign: 'center',
          marginTop: 16,
        }}
      >
        Billed through the App Store. Cancel anytime. Retailers — not you — fund shop commissions.
      </Text>
    </ScrollView>
  );
}

function SuperwallPurchaseButton({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const { registerPlacement } = usePlacement({
    onDismiss: (_info, result) => {
      setBusy(false);
      if (result.type === 'purchased' || result.type === 'restored') {
        Alert.alert("You're on Viola Plus", "Everything's unlocked.");
        onDone();
      }
    },
    onError: (error) => {
      setBusy(false);
      Alert.alert('Purchase unavailable', error);
    },
  });

  return (
    <Pressable
      disabled={busy}
      onPress={async () => {
        setBusy(true);
        try {
          await registerPlacement({ placement: 'campaign_trigger' });
        } catch (e) {
          setBusy(false);
          Alert.alert('Could not open paywall', e instanceof Error ? e.message : 'Unknown error');
        }
      }}
      style={{
        marginTop: 20,
        paddingVertical: 16,
        borderRadius: theme.radius.pill,
        backgroundColor: theme.color.viola,
        alignItems: 'center',
        opacity: busy ? 0.6 : 1,
      }}
    >
      <Text style={{ ...typeStyle('titleSm'), color: '#fff' }}>
        {busy ? 'Opening…' : 'Get Viola Plus'}
      </Text>
    </Pressable>
  );
}

function PlanCard({
  label,
  price,
  detail,
  badge,
}: {
  label: string;
  price: string;
  detail: string;
  badge?: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        padding: 16,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: badge ? theme.color.viola : theme.color.hairline,
        backgroundColor: badge ? theme.color.violaSoft : theme.color.surface,
      }}
    >
      {badge && (
        <Text style={{ ...typeStyle('itemLabel'), fontSize: 10, color: theme.color.violaText }}>
          {badge.toUpperCase()}
        </Text>
      )}
      <Text
        style={{
          ...typeStyle('bodySm'),
          color: theme.color.textSecondary,
          marginTop: badge ? 6 : 0,
        }}
      >
        {label}
      </Text>
      <Text style={{ ...typeStyle('statLg'), fontSize: 19, color: '#fff', marginTop: 4 }}>
        {price}
      </Text>
      <Text style={{ ...typeStyle('caption'), color: theme.color.textTertiary, marginTop: 2 }}>
        {detail}
      </Text>
    </View>
  );
}
