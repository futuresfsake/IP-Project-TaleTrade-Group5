// The app's own pop-up, replacing the system Alert so every dialog matches the design.
// `dialog.alert(title, message?, buttons?)` takes the same arguments as React Native's Alert.
import React, { useEffect, useState } from 'react';
import { Alert, AlertButton, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Info, TriangleAlert } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { AppButton } from '../feed/ui';

interface DialogRequest {
  title: string;
  message?: string;
  buttons?: AlertButton[];
}

let present: ((request: DialogRequest) => void) | null = null;

export const dialog = {
  alert(title: string, message?: string, buttons?: AlertButton[]) {
    // Falls back to the system dialog if the host is not mounted.
    if (present) present({ title, message, buttons });
    else Alert.alert(title, message, buttons);
  },
};

/** Mount once, near the root of the app. Requests queue up and show one at a time. */
export const DialogHost = () => {
  const [queue, setQueue] = useState<DialogRequest[]>([]);

  useEffect(() => {
    present = request => setQueue(q => [...q, request]);
    return () => {
      present = null;
    };
  }, []);

  const current = queue[0];
  if (!current) return null;

  const buttons: AlertButton[] = current.buttons?.length ? current.buttons : [{ text: 'OK' }];
  // The action reads first, "cancel" sits underneath.
  const ordered = [...buttons].sort((a, b) => Number(a.style === 'cancel') - Number(b.style === 'cancel'));
  const destructive = buttons.some(b => b.style === 'destructive');
  const Icon = destructive ? TriangleAlert : Info;

  const press = (button?: AlertButton) => {
    setQueue(q => q.slice(1));
    button?.onPress?.();
  };
  // Back button / outside tap: behave like "cancel", or like the only button.
  const dismiss = () =>
    press(buttons.find(b => b.style === 'cancel') ?? (buttons.length === 1 ? buttons[0] : undefined));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={dismiss} accessibilityLabel="Dismiss" />
      <View style={styles.center} pointerEvents="box-none">
        <View style={styles.dialog} accessibilityRole="alert">
          <View style={[styles.icon, destructive && styles.iconDanger]}>
            <Icon color={destructive ? colors.danger : colors.primary} size={26} />
          </View>
          <Text style={styles.title}>{current.title}</Text>
          {current.message ? <Text style={styles.message}>{current.message}</Text> : null}
          <View style={styles.buttons}>
            {ordered.map((b, i) => (
              <AppButton
                key={`${b.text}-${i}`}
                label={b.text ?? 'OK'}
                variant={b.style === 'cancel' ? 'secondary' : b.style === 'destructive' ? 'danger' : 'primary'}
                onPress={() => press(b)}
              />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.scrim },
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  dialog: { backgroundColor: colors.white, borderRadius: 28, padding: 24, alignItems: 'center' },
  icon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  iconDanger: { backgroundColor: colors.dangerTint },
  title: { fontSize: 20, fontWeight: '800', color: colors.heading, textAlign: 'center' },
  message: { fontSize: 14, color: colors.body, textAlign: 'center', lineHeight: 20, marginTop: 8 },
  buttons: { alignSelf: 'stretch', gap: 10, marginTop: 20 },
});
