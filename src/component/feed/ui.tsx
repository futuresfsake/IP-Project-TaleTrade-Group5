// Small shared building blocks for the Feed screens (buttons, chips, badges, segmented control...).
import React from 'react';
import {
  ActivityIndicator,
  Image,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Book, ChevronLeft } from 'lucide-react-native';
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
  secondary: { container: { backgroundColor: colors.chip }, text: { color: colors.accent } },
  danger: {
    container: { borderWidth: 1.5, borderColor: colors.danger, backgroundColor: 'transparent' },
    text: { color: colors.danger },
  },
  ghost: { container: { backgroundColor: 'transparent' }, text: { color: colors.accent } },
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

// ------------------------------------------------------------------- Headers and fields
export const BackButton = ({ onPress }: { onPress: () => void }) => (
  <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back" style={styles.back} onPress={onPress}>
    <ChevronLeft color={colors.accent} size={22} />
  </TouchableOpacity>
);

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}

export const ScreenHeader = ({ title, subtitle, onBack, right }: ScreenHeaderProps) => (
  <View style={styles.header}>
    {onBack ? <BackButton onPress={onBack} /> : null}
    <View style={styles.headerTitles}>
      <Text style={[styles.headerTitle, onBack ? styles.headerTitleStacked : null]} numberOfLines={1}>{title}</Text>
      {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
    </View>
    {right}
  </View>
);

export const Field = ({ label, style, ...input }: TextInputProps & { label: string }) => (
  <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      accessibilityLabel={label}
      placeholderTextColor={colors.muted}
      style={[styles.fieldInput, input.multiline ? styles.fieldMultiline : null, style]}
      {...input}
    />
  </View>
);

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  headerTitles: { flex: 1 },
  headerTitle: { fontSize: 28, fontWeight: '900', color: colors.accent },
  headerTitleStacked: { fontSize: 22, color: colors.heading },
  headerSubtitle: { fontSize: 14, color: colors.muted },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  field: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.ink },
  fieldInput: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    fontSize: 15,
    color: colors.ink,
  },
  fieldMultiline: { minHeight: 96, paddingTop: 14, textAlignVertical: 'top' },

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
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
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
  segmentTextOn: { color: colors.accent, fontWeight: '700' },

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
  emptyTitle: { fontSize: 22, fontWeight: '800', color: colors.heading, textAlign: 'center' },
  emptyBody: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 21, marginTop: 8 },
  emptyActions: { alignSelf: 'stretch', marginTop: 24, gap: 10 },
});
