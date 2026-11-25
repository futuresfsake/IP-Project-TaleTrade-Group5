// Small shared building blocks for the Feed screens (buttons, chips, badges, segmented control...).
import React from 'react';
import {
  ActivityIndicator,
  Image,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Book } from 'lucide-react-native';
import { colors, statusColors } from '../../theme/colors';
import { initialsOf } from '../../services/feedHelpers';
import type { ListingStatus } from '../../types';

// --------------------------------------------------------------------------- AppButton
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  small?: boolean;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const AppButton = ({
  label,
  onPress,
  variant = 'primary',
  small,
  loading,
  disabled,
  icon,
  style,
  testID,
}: AppButtonProps) => {
  const palette = buttonPalette[variant];
  const inactive = disabled || loading;
  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      onPress={onPress}
      disabled={inactive}
      activeOpacity={0.8}
      style={[
        styles.button,
        small ? styles.buttonSmall : styles.buttonRegular,
        palette.container,
        inactive && styles.buttonDisabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.text.color} />
      ) : (
        <>
          {icon}
          <Text style={[small ? styles.buttonTextSmall : styles.buttonText, palette.text]}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const buttonPalette: Record<ButtonVariant, { container: ViewStyle; text: { color: string } }> = {
  primary: {
    container: {
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 4,
    },
    text: { color: colors.white },
  },
  secondary: { container: { backgroundColor: colors.chip }, text: { color: colors.blue } },
  danger: {
    container: { borderWidth: 1.5, borderColor: colors.danger, backgroundColor: 'transparent' },
    text: { color: colors.danger },
  },
  ghost: { container: { backgroundColor: 'transparent' }, text: { color: colors.blue } },
};

// -------------------------------------------------------------------------------- Chip
interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: React.ReactNode;
  testID?: string;
}

export const Chip = ({ label, selected, onPress, icon, testID }: ChipProps) => (
  <TouchableOpacity
    testID={testID}
    accessibilityRole="button"
    accessibilityState={{ selected: !!selected }}
    onPress={onPress}
    activeOpacity={0.8}
    style={[styles.chip, selected && styles.chipSelected]}
  >
    {icon}
    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
  </TouchableOpacity>
);

// ------------------------------------------------------------------------- StatusBadge
export const StatusBadge = ({ status, label }: { status: ListingStatus; label?: string }) => {
  const palette = statusColors[status];
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <View style={[styles.badgeDot, { backgroundColor: palette.dot }]} />
      <Text style={[styles.badgeText, { color: palette.text }]}>
        {label ?? status.charAt(0).toUpperCase() + status.slice(1)}
      </Text>
    </View>
  );
};

// ------------------------------------------------------------------- SegmentedControl
interface SegmentedProps<T extends string> {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedProps<T>) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map(o => {
        const on = o.value === value;
        return (
          <TouchableOpacity
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, on && styles.segmentOn]}
            activeOpacity={0.8}
          >
            <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------- BookCover
interface BookCoverProps {
  uri?: string | null;
  width: number;
  height: number;
  radius?: number;
}

export const BookCover = ({ uri, width, height, radius = 12 }: BookCoverProps) => (
  <View style={[styles.cover, { width, height, borderRadius: radius }]}>
    {uri ? (
      <Image source={{ uri }} style={{ width, height, borderRadius: radius }} resizeMode="cover" />
    ) : (
      <Book color="#B4AECB" size={Math.round(width * 0.36)} strokeWidth={1.8} />
    )}
  </View>
);

// ------------------------------------------------------------------------------ Avatar
export const Avatar = ({ name, uri, size = 40 }: { name: string; uri?: string | null; size?: number }) => (
  <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
    {uri ? (
      <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
    ) : (
      <Text style={[styles.avatarText, { fontSize: Math.round(size * 0.36) }]}>{initialsOf(name)}</Text>
    )}
  </View>
);

// ------------------------------------------------------------------------- EmptyState
interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  body: string;
  children?: React.ReactNode;
}

export const EmptyState = ({ icon, title, body, children }: EmptyStateProps) => (
  <View style={styles.empty}>
    <View style={styles.emptyIcon}>{icon}</View>
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.emptyBody}>{body}</Text>
    {children ? <View style={styles.emptyActions}>{children}</View> : null}
  </View>
);

const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buttonRegular: { height: 52, paddingHorizontal: 24, borderRadius: 20 },
  buttonSmall: { height: 40, paddingHorizontal: 16, borderRadius: 14 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 16, fontWeight: '700' },
  buttonTextSmall: { fontSize: 14, fontWeight: '700' },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  chipSelected: { backgroundColor: colors.blue, borderColor: colors.blue },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.body },
  chipTextSelected: { color: colors.white },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    height: 26,
    paddingLeft: 8,
    paddingRight: 10,
    borderRadius: 13,
  },
  badgeDot: { width: 8, height: 8, borderRadius: 4 },
  badgeText: { fontSize: 12, fontWeight: '700' },

  segmented: { flexDirection: 'row', backgroundColor: colors.chip, borderRadius: 16, padding: 4, gap: 4 },
  segment: { flex: 1, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  segmentOn: {
    backgroundColor: colors.white,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  segmentText: { fontSize: 14, fontWeight: '600', color: colors.muted },
  segmentTextOn: { color: colors.blue, fontWeight: '700' },

  cover: { backgroundColor: colors.cover, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },

  avatar: { backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '700', color: colors.purple },

  empty: { alignItems: 'center', paddingHorizontal: 36, paddingTop: 48 },
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 22, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  emptyBody: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 21, marginTop: 8 },
  emptyActions: { alignSelf: 'stretch', marginTop: 24, gap: 10 },
});
