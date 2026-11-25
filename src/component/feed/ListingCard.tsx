// Community Feed post: owner, book, availability, meetup spot and actions.
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Bookmark, MapPin, Repeat } from 'lucide-react-native';
import { colors, shadow } from '../../theme/colors';
import { formatDistance } from '../../services/map/locationService';
import { CONDITION_LABELS, describeExchange, spotSummary, timeAgo } from '../../services/feedHelpers';
import type { FeedItem } from '../../types';
import { AppButton, Avatar, BookCover, StatusBadge } from './ui';

interface ListingCardProps {
  item: FeedItem;
  onOpenBook: (item: FeedItem) => void;
  onOpenOwner: (item: FeedItem) => void;
  onRequestMeetup: (item: FeedItem) => void;
  onSave: (item: FeedItem) => void;
  /** Shown instead of Request meetup / save when the post is the viewer's own. */
  onEdit?: (item: FeedItem) => void;
  now?: number;
}

const ListingCard = ({ item, onOpenBook, onOpenOwner, onRequestMeetup, onSave, onEdit, now }: ListingCardProps) => {
  const { owner, book } = item;
  const reserved = item.status === 'reserved';

  return (
    <View style={styles.card} testID={`listing-${item.id}`}>
      <TouchableOpacity style={styles.ownerRow} onPress={() => onOpenOwner(item)} activeOpacity={0.7}>
        <Avatar name={owner.username} uri={owner.photoURL} size={40} />
        <View style={styles.flex}>
          <Text style={styles.ownerName} numberOfLines={1}>{item.isMine ? `${owner.username} (you)` : owner.username}</Text>
          <Text style={styles.time}>{timeAgo(item.updatedAt, now)}</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.bookRow} onPress={() => onOpenBook(item)} activeOpacity={0.8}>
        <BookCover uri={book.thumbnail} width={76} height={112} />
        <View style={[styles.flex, styles.bookInfo]}>
          <Text style={styles.title} numberOfLines={2}>{book.title}</Text>
          <Text style={styles.author} numberOfLines={1}>{book.author}</Text>
          <View style={styles.tags}>
            <StatusBadge status={item.status} />
            <View style={styles.condition}>
              <Text style={styles.conditionText}>{CONDITION_LABELS[item.condition]}</Text>
            </View>
          </View>
          <View style={styles.exchange}>
            <Repeat color={colors.purple} size={14} />
            <Text style={styles.exchangeText} numberOfLines={1}>{describeExchange(item.exchange)}</Text>
          </View>
        </View>
      </TouchableOpacity>

      <View style={styles.meetup}>
        <MapPin color={colors.purple} size={18} />
        <View style={styles.flex}>
          <Text style={styles.meetLabel}>Meet at</Text>
          <Text style={styles.meetSpot} numberOfLines={1}>{spotSummary(item.spots)}</Text>
          {item.availableTimes ? <Text style={styles.meetTimes} numberOfLines={1}>{item.availableTimes}</Text> : null}
        </View>
        {item.nearestDistanceKm !== null ? (
          <Text style={styles.distance}>{formatDistance(item.nearestDistanceKm)}</Text>
        ) : null}
      </View>

      {item.note ? <Text style={styles.note}>“{item.note}”</Text> : null}

      {item.isMine ? (
        <View style={styles.actions}>
          <AppButton small variant="primary" style={styles.flex} label="Edit listing" onPress={() => onEdit?.(item)} />
        </View>
      ) : (
        <View style={styles.actions}>
          <AppButton
            small
            variant="primary"
            style={styles.flex}
            label={reserved ? 'View on map' : 'Request meetup'}
            onPress={() => onRequestMeetup(item)}
          />
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={item.wishlisted ? 'On your wishlist' : 'Save to wishlist'}
            style={styles.save}
            onPress={() => onSave(item)}
            activeOpacity={0.7}
          >
            <Bookmark color={colors.purple} size={18} fill={item.wishlisted ? colors.purple : 'none'} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { backgroundColor: colors.white, borderRadius: 24, padding: 16, gap: 14, ...shadow },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ownerName: { fontSize: 15, fontWeight: '700', color: colors.ink },
  time: { fontSize: 12, color: colors.muted },
  bookRow: { flexDirection: 'row', gap: 14 },
  bookInfo: { gap: 6 },
  title: { fontSize: 17, fontWeight: '800', color: colors.ink, lineHeight: 22 },
  author: { fontSize: 13, color: colors.muted },
  tags: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  condition: { height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: colors.chip, justifyContent: 'center' },
  conditionText: { fontSize: 12, fontWeight: '600', color: colors.purple },
  exchange: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  exchangeText: { flex: 1, fontSize: 12, fontWeight: '500', color: colors.body },
  meetup: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.field, borderRadius: 14, padding: 12 },
  meetLabel: { fontSize: 11, fontWeight: '500', color: colors.muted },
  meetSpot: { fontSize: 13, fontWeight: '700', color: colors.ink },
  meetTimes: { fontSize: 12, color: colors.body, marginTop: 1 },
  distance: { fontSize: 12, fontWeight: '700', color: colors.purple },
  note: { fontSize: 13, color: colors.body, fontStyle: 'italic', lineHeight: 19 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  save: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' },
});

export default React.memo(ListingCard);
