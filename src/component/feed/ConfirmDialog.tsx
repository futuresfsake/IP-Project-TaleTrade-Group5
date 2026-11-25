// Centered confirmation dialog (used to confirm removing a listing).
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { AppButton } from './ui';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog = ({ visible, title, body, confirmLabel, cancelLabel, loading, onConfirm, onCancel }: ConfirmDialogProps) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
    <Pressable style={styles.scrim} onPress={onCancel} accessibilityLabel="Dismiss" />
    <View style={styles.center} pointerEvents="box-none">
      <View style={styles.dialog} testID="confirm-dialog">
        <View style={styles.icon}>
          <Trash2 color={colors.danger} size={26} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        <AppButton variant="danger" label={confirmLabel} onPress={onConfirm} loading={loading} style={styles.btn} testID="confirm-remove" />
        <AppButton variant="secondary" label={cancelLabel} onPress={onCancel} disabled={loading} style={styles.btn} />
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFill as object, backgroundColor: colors.scrim },
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  dialog: { backgroundColor: colors.white, borderRadius: 28, padding: 24, alignItems: 'center', gap: 8 },
  icon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.dangerTint, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  body: { fontSize: 14, color: colors.body, textAlign: 'center', lineHeight: 20, marginBottom: 12 },
  btn: { alignSelf: 'stretch' },
});

export default ConfirmDialog;
