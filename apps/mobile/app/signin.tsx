import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, setSessionToken } from '@/api';
import { theme, typeStyle } from '@/theme';

/**
 * Sign in.
 *
 * Email and a six-digit code, matching the web. The native app receives the
 * session token in the response body and stores it in the keychain, because it
 * cannot rely on a Set-Cookie the way a browser does.
 */
export default function SignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.requestCode(email);
      if (result.devMode && result.devCode) setDevCode(result.devCode);
      setStep('code');
    } catch {
      setError('Could not send a code to that address.');
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.verifyCode(email, code);
      if (result.token) await setSessionToken(result.token);
      router.back();
    } catch {
      setError('That code did not match.');
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{
        flex: 1,
        backgroundColor: theme.color.ink,
        paddingTop: insets.top + 20,
        paddingHorizontal: 24,
      }}
    >
      <Pressable onPress={() => router.back()} hitSlop={12} style={{ alignSelf: 'flex-start' }}>
        <Text style={{ color: theme.color.textSecondary, fontSize: 15 }}>Close</Text>
      </Pressable>

      <Text style={{ ...typeStyle('displayLg'), color: '#fff', marginTop: 28 }}>
        {step === 'email' ? 'Sign in' : 'Check your email'}
      </Text>
      <Text style={{ ...typeStyle('body'), color: theme.color.textSecondary, marginTop: 8 }}>
        {step === 'email'
          ? 'No password. We send a six-digit code.'
          : `We sent a code to ${email}.`}
      </Text>

      {step === 'email' ? (
        <>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={theme.color.textTertiary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            style={inputStyle}
          />
          <Pressable
            onPress={sendCode}
            disabled={busy || email.length < 4}
            style={{ ...buttonStyle, opacity: busy || email.length < 4 ? 0.45 : 1 }}
          >
            <Text style={{ ...typeStyle('titleSm'), color: '#fff' }}>
              {busy ? 'Sending…' : 'Send code'}
            </Text>
          </Pressable>
        </>
      ) : (
        <>
          <TextInput
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, ''))}
            placeholder="000000"
            placeholderTextColor={theme.color.textTertiary}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            maxLength={6}
            style={{ ...inputStyle, textAlign: 'center', fontSize: 24, letterSpacing: 10 }}
          />
          <Pressable
            onPress={verify}
            disabled={busy || code.length !== 6}
            style={{ ...buttonStyle, opacity: busy || code.length !== 6 ? 0.45 : 1 }}
          >
            <Text style={{ ...typeStyle('titleSm'), color: '#fff' }}>
              {busy ? 'Checking…' : 'Continue'}
            </Text>
          </Pressable>

          {devCode && (
            <View
              style={{
                marginTop: 18,
                padding: 16,
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: 'rgba(240,195,107,0.28)',
                backgroundColor: 'rgba(240,195,107,0.07)',
              }}
            >
              <Text style={{ ...typeStyle('itemLabel'), color: theme.color.warning }}>
                DEVELOPMENT MODE
              </Text>
              <Text
                style={{
                  ...typeStyle('statLg'),
                  color: '#fff',
                  marginTop: 8,
                  letterSpacing: 8,
                }}
              >
                {devCode}
              </Text>
              <Pressable onPress={() => setCode(devCode)} style={{ marginTop: 10 }}>
                <Text style={{ ...typeStyle('bodySm'), color: theme.color.warning }}>
                  Use this code
                </Text>
              </Pressable>
            </View>
          )}
        </>
      )}

      {error && (
        <Text style={{ ...typeStyle('bodySm'), color: theme.color.danger, marginTop: 14 }}>
          {error}
        </Text>
      )}

      <Text style={{ ...typeStyle('caption'), color: theme.color.textTertiary, marginTop: 28 }}>
        Anything you bloomed before signing in is kept and moved to your account.
      </Text>
    </KeyboardAvoidingView>
  );
}

const inputStyle = {
  marginTop: 24,
  paddingHorizontal: 16,
  paddingVertical: 15,
  borderRadius: theme.radius.lg,
  borderWidth: 1,
  borderColor: theme.color.hairline,
  backgroundColor: theme.color.surface,
  color: '#fff',
  fontSize: 16,
} as const;

const buttonStyle = {
  marginTop: 12,
  paddingVertical: 15,
  borderRadius: theme.radius.pill,
  backgroundColor: theme.color.viola,
  alignItems: 'center',
} as const;
