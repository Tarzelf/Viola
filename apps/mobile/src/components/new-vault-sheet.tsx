import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api, ApiError } from '@/api';
import { theme, typeStyle } from '@/theme';

/**
 * Naming a new vault.
 *
 * A free account is refused with 402 and a paywall trigger, which the caller
 * turns into the upgrade prompt. The check also happens before the request
 * where the limit is already known, so someone at their cap gets an immediate
 * answer instead of a round trip that is certain to fail.
 */
export function NewVaultSheet({
  visible,
  onClose,
  onCreated,
  onPaywall,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
  onPaywall: () => void;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;

    setBusy(true);
    setError(null);

    try {
      await api.createVault(trimmed);
      setName('');
      onCreated();
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) {
        onClose();
        onPaywall();
        return;
      }
      setError(e instanceof ApiError ? e.message : 'Could not create that');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(11,10,15,0.72)' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close" />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View
            style={{
              paddingHorizontal: 24,
              paddingTop: 24,
              paddingBottom: 34,
              borderTopLeftRadius: theme.radius.xl,
              borderTopRightRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: theme.color.hairline,
              backgroundColor: theme.color.surface,
            }}
          >
            <Text style={{ ...typeStyle('displayMd'), color: '#fff' }}>New vault</Text>

            <TextInput
              autoFocus={visible}
              value={name}
              onChangeText={setName}
              onSubmitEditing={create}
              maxLength={48}
              returnKeyType="done"
              placeholder="Summer, going out, wishlist…"
              placeholderTextColor={theme.color.textTertiary}
              style={{
                marginTop: 16,
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: theme.color.hairline,
                backgroundColor: theme.color.surfaceRaised,
                color: '#fff',
                fontSize: 16,
              }}
            />

            {error && (
              <Text style={{ ...typeStyle('bodySm'), color: theme.color.danger, marginTop: 12 }}>
                {error}
              </Text>
            )}

            <Pressable
              onPress={create}
              disabled={busy || name.trim().length === 0}
              style={{
                marginTop: 16,
                paddingVertical: 15,
                borderRadius: theme.radius.pill,
                backgroundColor: theme.color.viola,
                alignItems: 'center',
                opacity: busy || name.trim().length === 0 ? 0.45 : 1,
              }}
            >
              <Text style={{ ...typeStyle('titleSm'), color: '#fff' }}>
                {busy ? 'Creating…' : 'Create'}
              </Text>
            </Pressable>

            <Pressable onPress={onClose} style={{ marginTop: 12, alignItems: 'center' }}>
              <Text style={{ ...typeStyle('bodySm'), color: theme.color.textTertiary }}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
