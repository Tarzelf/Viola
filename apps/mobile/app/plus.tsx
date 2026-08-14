import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PRICES, formatPrice } from '@viola/core';
import { theme, typeStyle } from '@/theme';

/**
 * Viola Plus, on iOS.
 *
 * IMPORTANT: this must complete through StoreKit, not a web checkout. Apple
 * requires in-app purchase for digital features consumed inside the app
 * (guideline 3.1.1), and linking out to Stripe here would be rejected.
 * react-native-purchases is in the dependency list for exactly this, and needs
 * a RevenueCat key plus App Store Connect products before it can be wired —
 * neither of which can be created from this machine.
 *
 * Affiliate shop links are a completely different case and stay as they are:
 * physical goods consumed outside the app must NOT use IAP (3.1.3(e)).
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

      <Text style={{ ...typeStyle('itemLabel'), color: theme.color.viola, marginTop: 22 }}>
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
              <Text style={{ color: theme.color.viola, fontSize: 11 }}>✓</Text>
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

      <Pressable
        onPress={() =>
          Alert.alert(
            'In-app purchase',
            'Viola Plus must be bought through the App Store on iOS. Connect a RevenueCat key and App Store Connect products to enable this.',
          )
        }
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

      <Text
        style={{
          ...typeStyle('caption'),
          color: theme.color.textTertiary,
          textAlign: 'center',
          marginTop: 16,
        }}
      >
        Cancel any time. Buying something you found through Viola never costs extra — retailers pay
        us, not you.
      </Text>
    </ScrollView>
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
        <Text style={{ ...typeStyle('itemLabel'), fontSize: 10, color: theme.color.viola }}>
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
