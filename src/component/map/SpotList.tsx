import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Star, X } from 'lucide-react-native';
import { formatDistance } from '../../services/map/locationService';
import type { MeetupSpot } from '../../types';

const COLORS = {
  primaryBlue: '#6C63A8',
  softPurple: '#7E6FB0',
  white: '#FFFFFF',
  inputBg: '#F9F7F2',
  gold: '#E8A317',
};

interface SpotListProps {
  /** Already ordered by the caller (nearest-first or alphabetical). */
  spots: MeetupSpot[];
  counts: Record<string, number>;
  wishlistCounts: Record<string, number>;
  /** km per spot id, or null when the user's position isn't available. */
  distances: Record<string, number> | null;
  sortNearest: boolean;
  bottomOffset: number;
  onToggleSort: () => void;
  onSelect: (spot: MeetupSpot) => void;
  onClose: () => void;
}

const SpotList = ({
  spots, counts, wishlistCounts, distances, sortNearest, bottomOffset, onToggleSort, onSelect, onClose,
}: SpotListProps) => (
  <View style={[styles.panel, { bottom: bottomOffset }]}>
    <View style={styles.header}>
      <Text style={styles.title}>Meetup spots</Text>
      <TouchableOpacity onPress={onClose} accessibilityLabel="Close">
        <X color={COLORS.softPurple} size={22} />
      </TouchableOpacity>
    </View>

    {distances ? (
      <TouchableOpacity
        style={[styles.sortBtn, sortNearest && styles.sortBtnActive]}
        onPress={onToggleSort}
        accessibilityRole="button"
        accessibilityState={{ selected: sortNearest }}
      >
        <Text style={[styles.sortText, sortNearest && styles.sortTextActive]}>Nearest first</Text>
      </TouchableOpacity>
    ) : (
      <Text style={styles.hint}>Turn on "locate me" to see distances.</Text>
    )}

    <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
      {spots.length === 0 && <Text style={styles.hint}>No meetup spots to show.</Text>}
      {spots.map(spot => (
        <TouchableOpacity key={spot.id} style={styles.row} onPress={() => onSelect(spot)}>
          <View style={styles.rowText}>
            <Text style={styles.name} numberOfLines={1}>{spot.name}</Text>
            <Text style={styles.meta}>
              <Text style={styles.cap}>{spot.type}</Text> · {counts[spot.id] ?? 0} {(counts[spot.id] ?? 0) === 1 ? 'book' : 'books'}
              {distances && spot.id in distances ? ` · ${formatDistance(distances[spot.id])}` : ''}
            </Text>
          </View>
          {(wishlistCounts[spot.id] ?? 0) > 0 && <Star color={COLORS.gold} fill={COLORS.gold} size={18} />}
        </TouchableOpacity>
      ))}
    </ScrollView>
  </View>
);

const styles = StyleSheet.create({
  panel: { position: 'absolute', left: 15, right: 15, maxHeight: '55%', backgroundColor: COLORS.white, borderRadius: 30, padding: 20, elevation: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '900', color: COLORS.primaryBlue },
  sortBtn: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#F3F1FB', marginBottom: 10 },
  sortBtnActive: { backgroundColor: COLORS.primaryBlue },
  sortText: { fontSize: 13, fontWeight: '700', color: COLORS.primaryBlue },
  sortTextActive: { color: COLORS.white },
  hint: { fontSize: 13, color: '#777', marginBottom: 8 },
  list: { flexGrow: 0, flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.inputBg, borderRadius: 16, padding: 12, marginBottom: 8 },
  rowText: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: '#444' },
  meta: { fontSize: 12, color: '#888', marginTop: 2 },
  cap: { textTransform: 'capitalize' },
});

export default SpotList;
