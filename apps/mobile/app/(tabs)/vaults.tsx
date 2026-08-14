import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, ApiError } from '@/api';
import { theme, typeStyle } from '@/theme';

type Vaults = Awaited<ReturnType<typeof api.vaults>>;

/**
 * Vaults — the paid feature.
 *
 * Free accounts get one, called Saved. Attempting a second surfaces the
 * paywall, and on iOS that upgrade must go through StoreKit rather than a web
 * checkout: Apple requires in-app purchase for digital features consumed in
 * the app. Affiliate links are unaffected — physical goods bought outside the
 * app must NOT use IAP.
 */
export default function VaultsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<Vaults | null>(null);
  const [signedOut, setSignedOut] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        try {
          setData(await api.vaults());
          setSignedOut(false);
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) setSignedOut(true);
        }
      })();
    }, []),
  );

  if (signedOut) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.color.ink,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 40,
        }}
      >
        <Text style={{ ...typeStyle('displayMd'), color: '#fff' }}>Your vaults</Text>
        <Text
          style={{
            ...typeStyle('bodySm'),
            color: theme.color.textSecondary,
            marginTop: 8,
            textAlign: 'center',
          }}
        >
          Sign in to save pieces you love.
        </Text>
        <Pressable
          onPress={() => router.push('/signin')}
          style={{
            marginTop: 22,
            paddingHorizontal: 22,
            paddingVertical: 13,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.color.viola,
          }}
        >
          <Text style={{ ...typeStyle('titleSm'), color: '#fff' }}>Sign in</Text>
        </Pressable>
      </View>
    );
  }

  const atLimit =
    data?.limits.maxVaults !== null &&
    data !== null &&
    data.usage.vaultCount >= (data.limits.maxVaults ?? Infinity);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.color.ink }}
      contentContainerStyle={{
        paddingTop: insets.top + 8,
        paddingHorizontal: 16,
        paddingBottom: 40,
      }}
    >
      <Text style={{ ...typeStyle('displayLg'), color: '#fff' }}>Vaults</Text>
      <Text style={{ ...typeStyle('bodySm'), color: theme.color.textSecondary, marginTop: 6 }}>
        {data?.limits.maxSavedItems
          ? `${data.usage.savedItemCount} of ${data.limits.maxSavedItems} pieces saved`
          : `${data?.usage.savedItemCount ?? 0} pieces saved`}
      </Text>

      <Pressable
        onPress={() =>
          atLimit
            ? Alert.alert(
                'Room for more',
                'Saved is your free vault. Viola Plus lets you make as many as you like — by season, by mood, by whatever.',
                [
                  { text: 'Not now', style: 'cancel' },
                  { text: 'See Viola Plus', onPress: () => router.push('/plus') },
                ],
              )
            : Alert.alert('New vault', 'Naming a vault is coming to the app shortly.')
        }
        style={{
          alignSelf: 'flex-start',
          marginTop: 16,
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: theme.radius.pill,
          borderWidth: 1,
          borderColor: theme.color.hairline,
        }}
      >
        <Text style={{ ...typeStyle('bodySm'), color: theme.color.textSecondary }}>New vault</Text>
      </Pressable>

      <View style={{ marginTop: 22, gap: 12 }}>
        {(data?.vaults ?? []).map((vault) => (
          <View
            key={vault.id}
            style={{
              padding: 18,
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: theme.color.hairline,
              backgroundColor: theme.color.surface,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ ...typeStyle('titleMd'), color: '#fff' }}>{vault.name}</Text>
              {vault.isDefault && (
                <Text
                  style={{
                    ...typeStyle('itemLabel'),
                    fontSize: 10,
                    color: theme.color.textTertiary,
                  }}
                >
                  FREE
                </Text>
              )}
            </View>
            <Text
              style={{ ...typeStyle('caption'), color: theme.color.textTertiary, marginTop: 4 }}
            >
              {vault.itemCount} {vault.itemCount === 1 ? 'piece' : 'pieces'}
            </Text>
          </View>
        ))}
      </View>

      {data?.tier === 'free' && (
        <Pressable
          onPress={() => router.push('/plus')}
          style={{
            marginTop: 26,
            padding: 18,
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: 'rgba(124,92,252,0.3)',
            backgroundColor: theme.color.violaSoft,
          }}
        >
          <Text style={{ ...typeStyle('titleSm'), color: '#fff' }}>Viola Plus</Text>
          <Text style={{ ...typeStyle('bodySm'), color: theme.color.textSecondary, marginTop: 4 }}>
            Unlimited vaults, no sponsored posts.
          </Text>
        </Pressable>
      )}
    </ScrollView>
  );
}
