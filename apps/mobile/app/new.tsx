import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, ApiError } from '@/api';
import { theme, typeStyle } from '@/theme';

/**
 * Upload and the Voilà.
 *
 * The reveal choreography runs on the device's own clock rather than on data
 * arrival, exactly as it does on the web. A fast backend should make the reveal
 * smooth, not skip it — this is the one genuinely delightful moment the product
 * has, and letting it collapse into an instant jump throws it away.
 *
 * Each piece landing gets a light haptic. That physical drumbeat is the part
 * the web version cannot do, and it is most of why the wait feels like a
 * reveal here rather than a load.
 */

const REVEAL_INTERVAL_MS = 520;
const SCORE_DELAY_MS = 420;
const SCORE_HOLD_MS = 1700;
const MAX_EDGE = 1600;

const STAGE_COPY: Record<string, string> = {
  'stage:ingest': 'Reading your photo',
  'stage:vision': 'Finding the pieces',
  'stage:resolve': 'Looking up where to buy',
  'stage:layout': 'Laying out your card',
};

type Phase = 'idle' | 'preparing' | 'processing' | 'done' | 'error';

export default function NewLookScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [phase, setPhase] = useState<Phase>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [found, setFound] = useState<Array<{ id: string; label: string }>>([]);
  const [revealed, setRevealed] = useState(0);
  const [score, setScore] = useState<{ value: number; archetype: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingRef = useRef<{ value: number; archetype: string } | null>(null);
  const slugRef = useRef<string | null>(null);

  useEffect(() => () => void (pollRef.current && clearInterval(pollRef.current)), []);

  // Release one piece at a time, with a haptic tick as each lands.
  useEffect(() => {
    if (revealed >= found.length) return;
    const timer = setTimeout(() => {
      setRevealed((n) => n + 1);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, REVEAL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [revealed, found.length]);

  // The score lands only once every piece has appeared.
  useEffect(() => {
    if (!pendingRef.current || found.length === 0 || revealed < found.length) return;

    const value = pendingRef.current;
    pendingRef.current = null;

    const scoreTimer = setTimeout(() => {
      setScore(value);
      setPhase('done');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, SCORE_DELAY_MS);

    const navTimer = setTimeout(() => {
      if (slugRef.current) router.replace(`/l/${slugRef.current}`);
    }, SCORE_DELAY_MS + SCORE_HOLD_MS);

    return () => {
      clearTimeout(scoreTimer);
      clearTimeout(navTimer);
    };
  }, [revealed, found.length, router]);

  const pick = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Viola needs access to your photos to post a look.');
      setPhase('error');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setPreview(asset.uri);
    setPhase('preparing');

    try {
      // Downscale on device. A modern phone photo is several megabytes and
      // uploading it whole is the slowest step in the flow on cellular.
      const resized = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: Math.min(MAX_EDGE, asset.width ?? MAX_EDGE) } }],
        { compress: 0.88, format: ImageManipulator.SaveFormat.JPEG },
      );

      const { slug } = await api.upload(resized.uri);
      slugRef.current = slug;
      setPhase('processing');
      startPolling(slug);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        router.replace('/signin');
        return;
      }
      if (e instanceof ApiError && e.status === 429) {
        setError(e.message);
        setPhase('error');
        return;
      }
      setError('That upload did not go through.');
      setPhase('error');
    }
  }, [router]);

  function startPolling(slug: string) {
    pollRef.current = setInterval(async () => {
      try {
        const data = await api.lookStatus(slug);
        setStage(data.stage);
        setFound(
          data.items.map((i) => ({
            id: i.id,
            label: [i.brand, i.title ?? i.subtype].filter(Boolean).join(' '),
          })),
        );

        if (data.ready) {
          stop();
          if (data.score !== null && data.archetype) {
            pendingRef.current = { value: data.score, archetype: data.archetype };
          }
        } else if (data.failed) {
          stop();
          setError('We could not read that one. Try a clearer photo?');
          setPhase('error');
        } else if (data.quarantined) {
          stop();
          setError('That upload did not pass our content check.');
          setPhase('error');
        }
      } catch {
        /* transient; the next tick retries */
      }
    }, 700);
  }

  function stop() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  }

  /**
   * The composer can be opened as the very first route — from a deep link, or
   * on a cold start — in which case there is nothing to go back to and
   * router.back() logs an unhandled GO_BACK. Fall back to the feed.
   */
  function close() {
    stop();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  const cardWidth = width - 32;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.color.ink,
        paddingTop: insets.top + 12,
        paddingHorizontal: 16,
      }}
    >
      <Pressable onPress={close} hitSlop={12} style={{ alignSelf: 'flex-start' }}>
        <Text style={{ color: theme.color.textSecondary, fontSize: 15 }}>Close</Text>
      </Pressable>

      {phase === 'idle' && (
        <View style={{ marginTop: 28 }}>
          <Text style={{ ...typeStyle('displayLg'), color: '#fff' }}>Post a fit</Text>
          <Text style={{ ...typeStyle('body'), color: theme.color.textSecondary, marginTop: 8 }}>
            Viola names every piece, scores the look, and finds where to buy it.
          </Text>

          <Pressable
            onPress={pick}
            style={({ pressed }) => ({
              marginTop: 28,
              paddingVertical: 56,
              alignItems: 'center',
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: theme.color.hairlineStrong,
              backgroundColor: pressed ? 'rgba(124,92,252,0.06)' : theme.color.surface,
            })}
          >
            <View
              style={{
                width: 54,
                height: 54,
                borderRadius: 27,
                backgroundColor: theme.color.violaSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: theme.color.violaText, fontSize: 22 }}>↑</Text>
            </View>
            <Text style={{ ...typeStyle('titleSm'), color: '#fff', marginTop: 14 }}>
              Choose a photo
            </Text>
            <Text
              style={{ ...typeStyle('caption'), color: theme.color.textTertiary, marginTop: 4 }}
            >
              A mirror selfie works best
            </Text>
          </Pressable>

          <Text
            style={{
              ...typeStyle('caption'),
              color: theme.color.textTertiary,
              textAlign: 'center',
              marginTop: 16,
            }}
          >
            Location data is stripped from every upload before it is stored.
          </Text>
        </View>
      )}

      {phase === 'error' && (
        <View style={{ marginTop: 60, alignItems: 'center' }}>
          <Text style={{ ...typeStyle('displayMd'), color: '#fff' }}>That didn&rsquo;t work</Text>
          <Text
            style={{
              ...typeStyle('bodySm'),
              color: theme.color.textSecondary,
              marginTop: 8,
              textAlign: 'center',
            }}
          >
            {error}
          </Text>
          <Pressable
            onPress={() => {
              setPhase('idle');
              setError(null);
              setPreview(null);
              setFound([]);
              setRevealed(0);
            }}
            style={{
              marginTop: 22,
              paddingHorizontal: 20,
              paddingVertical: 12,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.color.viola,
            }}
          >
            <Text style={{ ...typeStyle('titleSm'), color: '#fff' }}>Try another photo</Text>
          </Pressable>
        </View>
      )}

      {(phase === 'preparing' || phase === 'processing' || phase === 'done') && (
        <View style={{ marginTop: 20 }}>
          <View
            style={{
              width: cardWidth,
              height: cardWidth * 1.25,
              borderRadius: theme.radius.xl,
              overflow: 'hidden',
              backgroundColor: theme.color.surface,
            }}
          >
            {preview && (
              <Image
                source={{ uri: preview }}
                style={{ position: 'absolute', width: cardWidth, height: cardWidth * 1.25 }}
                contentFit="cover"
              />
            )}
            <View
              style={{
                position: 'absolute',
                width: cardWidth,
                height: cardWidth * 1.25,
                backgroundColor: 'rgba(11,10,15,0.5)',
              }}
            />

            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 24,
              }}
            >
              {score ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'baseline',
                    gap: 10,
                    backgroundColor: theme.color.viola,
                    paddingHorizontal: 22,
                    paddingVertical: 11,
                    borderRadius: theme.radius.pill,
                  }}
                >
                  <Text style={{ ...typeStyle('displayMd'), color: '#fff' }}>
                    {score.archetype}
                  </Text>
                  <Text
                    style={{
                      ...typeStyle('statLg'),
                      fontSize: 20,
                      color: 'rgba(255,255,255,0.75)',
                    }}
                  >
                    {score.value}
                  </Text>
                </View>
              ) : (
                <>
                  <ActivityIndicator color="#fff" />
                  <Text style={{ ...typeStyle('displayMd'), color: '#fff', marginTop: 14 }}>
                    {phase === 'preparing' ? 'Getting your photo ready' : 'Voilà, almost'}
                  </Text>
                  <Text
                    style={{
                      ...typeStyle('bodySm'),
                      color: 'rgba(255,255,255,0.7)',
                      marginTop: 6,
                    }}
                  >
                    {found.length > 0 && revealed < found.length
                      ? `Found ${revealed} of ${found.length} pieces`
                      : (stage && STAGE_COPY[stage]) || 'Getting started'}
                  </Text>
                </>
              )}
            </View>
          </View>

          <View style={{ marginTop: 16, gap: 8 }}>
            {found.slice(0, revealed).map((item) => (
              <View
                key={item.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderRadius: theme.radius.lg,
                  borderWidth: 1,
                  borderColor: theme.color.hairline,
                  backgroundColor: theme.color.surface,
                }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: theme.color.violaSoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: theme.color.violaText, fontSize: 12 }}>✓</Text>
                </View>
                <Text
                  numberOfLines={1}
                  style={{ ...typeStyle('itemLabel'), color: '#fff', flex: 1 }}
                >
                  {item.label.toUpperCase()}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
