// A listing in the "My listings" tab: status, spots, availability switch and Edit.
import React from 'react';
import { StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { colors, shadow, statusColors } from '../../theme/colors';
import { availabilityToggle, spotSummary } from '../../services/feedHelpers';
import type { FeedItem, ListingStatus } from '../../types';
import { AppButton, BookCover, StatusBadge } from './ui';

interface MyListingCardProps {
  item: FeedItem;
  busy?: boolean;
  onToggle: (item: FeedItem, next: ListingStatus) => void;
  onEdit: (item: FeedItem) => void;
  /** Opens the post as readers see it. */
  onView: (item: FeedItem) => void;
}

const MyListingCard = ({ item, busy, onToggle, onEdit, onView }: MyListingCardProps) => {
  const toggle = availabilityToggle(item.status);
  return (
    <View style={styles.card} testID={`my-listing-${item.id}`}>
      <TouchableOpacity style={styles.row} onPress={() => onView(item)} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={`View your post for ${item.book.title}`}>
        <BookCover uri={item.book.thumbnail} width={64} height={94} />
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={2}>{item.book.title}</Text>
          <Text style={styles.author} numberOfLines={1}>{item.book.author}</Text>
          <StatusBadge status={item.status} />
          <View style={styles.spot}>
            <MapPin color={colors.purple} size={14} />
            <Text style={styles.spotText} numberOfLines={1}>{spotSummary(item.spots)}</Text>
          </View>
        </View>
      </TouchableOpacity>
      <View style={styles.divider} />
      <View style={styles.footer}>
        <View style={styles.switchRow}>
          <Switch
            accessibilityLabel={toggle.label}
            value={toggle.on}
            disabled={busy}
            onValueChange={() => onToggle(item, toggle.next)}
            trackColor={{ false: statusColors.unavailable.dot, true: statusColors.available.dot }}
            thumbColor={colors.white}
          />
          <Text style={styles.switchLabel}>{toggle.label}</Text>
        </View>
        <AppButton small variant="secondary" label="Edit" onPress={() => onEdit(item)} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: 24, padding: 14, gap: 12, ...shadow },
  row: { flexDirection: 'row', gap: 14 },
  info: { flex: 1, gap: 5 },
  title: { fontSize: 16, fontWeight: '800', color: colors.ink, lineHeight: 20 },
  author: { fontSize: 13, color: colors.muted },
  spot: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  spotText: { flex: 1, fontSize: 12, fontWeight: '500', color: colors.body },
  divider: { height: 1, backgroundColor: colors.border },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  switchLabel: { fontSize: 13, fontWeight: '600', color: colors.body, flexShrink: 1 },
});

export default React.memo(MyListingCard);
