import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Image, TextInput,
} from 'react-native';
import { ChevronDown, ChevronUp, X } from 'lucide-react-native';
import { getBooksAtSpot, groupBooksByBookId, filterBooks } from '../../services/map/meetupService';
import type { GroupedBook } from '../../services/map/meetupService';
import { getUsername } from '../../services/userService';
import { formatDistance } from '../../services/map/locationService';
import type { MeetupSpot, SpotBook } from '../../types';

const COLORS = {
  primaryBlue: '#4A68BE',
  softPurple: '#7E6FB0',
  white: '#FFFFFF',
  inputBg: '#F9F7F2',
  gold: '#E8A317',
};

const PAGE_SIZE = 20;
const SEARCH_THRESHOLD = 10;

interface SpotSheetProps {
  spot: MeetupSpot;
  /** Book ids on the current user's wishlist (already read by the map screen). */
  wishlistIds: string[];
  currentUserId?: string;
  /** Distance from the user in km, when their position is known. */
  distanceKm?: number;
  bottomOffset: number;
  onClose: () => void;
  onOpenBook: (book: GroupedBook) => void;
  onOpenOwner: (ownerId: string) => void;
}

const SpotSheet = ({
  spot, wishlistIds, currentUserId, distanceKm, bottomOffset, onClose, onOpenBook, onOpenOwner,
}: SpotSheetProps) => {
  const [rows, setRows] = useState<SpotBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [shown, setShown] = useState(PAGE_SIZE);
  const [infoOpen, setInfoOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setRows(await getBooksAtSpot(spot.id));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [spot.id]);

  // Reset UI state and reload when a different spot is opened.
  useEffect(() => {
    setSearch('');
    setShown(PAGE_SIZE);
    setExpanded(null);
    setInfoOpen(false);
  }, [spot.id]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleOwners = async (book: GroupedBook) => {
    if (expanded === book.bookId) {
      setExpanded(null);
      return;
    }
    setExpanded(book.bookId);
    // Usernames are fetched lazily, only for the owners of the row being opened.
    const missing = book.ownerIds.filter(id => !(id in names));
    if (missing.length > 0) {
      const fetched = await Promise.all(missing.map(id => getUsername(id)));
      setNames(prev => {
        const next = { ...prev };
        missing.forEach((id, i) => {
          next[id] = fetched[i] || 'Anonymous';
        });
        return next;
      });
    }
  };

  // Regrouped locally, so a wishlist refresh re-sorts without re-reading Firestore.
  const books = useMemo(
    () => groupBooksByBookId(rows, wishlistIds, currentUserId),
    [rows, wishlistIds, currentUserId],
  );
  const matches = useMemo(() => filterBooks(books, search), [books, search]);
  const visible = matches.slice(0, shown);

  return (
    <View style={[styles.sheet, { bottom: bottomOffset }]}>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{spot.name}</Text>
          <Text style={styles.type}>
            <Text style={styles.cap}>{spot.type}</Text>
            {distanceKm !== undefined ? ` · ${formatDistance(distanceKm)} away` : ''}
          </Text>
        </View>
        <TouchableOpacity onPress={onClose} accessibilityLabel="Close">
          <X color={COLORS.softPurple} size={22} />
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Books</Text>

      {loading ? (
        <ActivityIndicator color={COLORS.primaryBlue} style={styles.state} />
      ) : error ? (
        <View style={styles.state}>
          <Text style={styles.stateText}>Couldn't load books for this spot.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : books.length === 0 ? (
        <Text style={[styles.stateText, styles.state]}>
          No books here yet. Add this spot in Settings to list yours.
        </Text>
      ) : (
        <>
          {books.length > SEARCH_THRESHOLD && (
            <TextInput
              style={styles.search}
              value={search}
              onChangeText={text => {
                setSearch(text);
                setShown(PAGE_SIZE);
              }}
              placeholder="Search title or author"
              placeholderTextColor="#AAA"
              autoCorrect={false}
            />
          )}

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {visible.map(book => (
              <View key={book.bookId} style={styles.bookCard}>
                <TouchableOpacity style={styles.bookMain} onPress={() => onOpenBook(book)}>
                  {book.thumbnail ? (
                    <Image source={{ uri: book.thumbnail }} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.thumbPlaceholder]} />
                  )}
                  <View style={styles.bookText}>
                    <Text style={styles.bookTitle} numberOfLines={2}>{book.title}</Text>
                    <Text style={styles.bookAuthor} numberOfLines={1}>{book.author}</Text>
                    {book.wishlisted && <Text style={styles.wishTag}>★ On your wishlist</Text>}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.ownerToggle} onPress={() => toggleOwners(book)}>
                  <Text style={styles.ownerCount}>
                    {book.ownerCount} {book.ownerCount === 1 ? 'owner' : 'owners'}
                  </Text>
                  {expanded === book.bookId
                    ? <ChevronUp color={COLORS.softPurple} size={16} />
                    : <ChevronDown color={COLORS.softPurple} size={16} />}
                </TouchableOpacity>

                {expanded === book.bookId && (
                  <View style={styles.ownerList}>
                    {book.ownerIds.map(id => (
                      <TouchableOpacity key={id} onPress={() => onOpenOwner(id)}>
                        <Text style={styles.ownerName}>
                          {id === currentUserId ? 'You' : names[id] || '...'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ))}

            {matches.length === 0 && <Text style={styles.stateText}>No books match your search.</Text>}

            {matches.length > shown && (
              <TouchableOpacity style={styles.moreBtn} onPress={() => setShown(n => n + PAGE_SIZE)}>
                <Text style={styles.moreText}>Show more ({matches.length - shown} left)</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </>
      )}

      <View style={styles.footer}>
        <TouchableOpacity style={styles.infoToggle} onPress={() => setInfoOpen(o => !o)}>
          <Text style={styles.sectionTitle}>Spot info</Text>
          {infoOpen
            ? <ChevronUp color={COLORS.softPurple} size={18} />
            : <ChevronDown color={COLORS.softPurple} size={18} />}
        </TouchableOpacity>
        {infoOpen && (
          <View>
            <Text style={styles.info}>📍 {spot.address}</Text>
            {!!spot.openHours && <Text style={styles.info}>🕒 {spot.openHours}</Text>}
            {!!spot.safetyNote && <Text style={styles.safety}>⚠️ {spot.safetyNote}</Text>}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sheet: { position: 'absolute', left: 15, right: 15, maxHeight: '62%', backgroundColor: COLORS.white, borderRadius: 30, padding: 20, elevation: 10 },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  titleWrap: { flex: 1, marginRight: 10 },
  title: { fontSize: 18, fontWeight: '900', color: COLORS.primaryBlue },
  type: { fontSize: 12, fontWeight: '700', color: COLORS.softPurple, marginTop: 2 },
  cap: { textTransform: 'capitalize' },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.primaryBlue, marginTop: 8, marginBottom: 8 },
  state: { marginVertical: 12, alignItems: 'center' },
  stateText: { fontSize: 14, color: '#777', textAlign: 'center', marginVertical: 8 },
  retryBtn: { backgroundColor: COLORS.primaryBlue, paddingVertical: 8, paddingHorizontal: 20, borderRadius: 16 },
  retryText: { color: COLORS.white, fontWeight: '800' },
  search: { backgroundColor: COLORS.inputBg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8, fontSize: 14, color: '#444', marginBottom: 8 },
  list: { flexGrow: 0, flexShrink: 1 },
  bookCard: { backgroundColor: COLORS.inputBg, borderRadius: 16, padding: 10, marginBottom: 8 },
  bookMain: { flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 36, height: 52, borderRadius: 6, marginRight: 10 },
  thumbPlaceholder: { backgroundColor: '#E5E0F0' },
  bookText: { flex: 1 },
  bookTitle: { fontSize: 14, fontWeight: '700', color: '#444' },
  bookAuthor: { fontSize: 12, color: '#888', marginTop: 1 },
  wishTag: { fontSize: 11, fontWeight: '800', color: COLORS.gold, marginTop: 2 },
  ownerToggle: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 4, marginTop: 6 },
  ownerCount: { fontSize: 12, fontWeight: '700', color: COLORS.softPurple },
  ownerList: { marginTop: 6, paddingLeft: 46 },
  ownerName: { fontSize: 13, fontWeight: '700', color: COLORS.primaryBlue, textDecorationLine: 'underline', paddingVertical: 3 },
  moreBtn: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 18, borderRadius: 14, backgroundColor: '#F3F1FB', marginBottom: 4 },
  moreText: { color: COLORS.primaryBlue, fontWeight: '700', fontSize: 13 },
  footer: { borderTopWidth: 1, borderTopColor: '#EEE', marginTop: 4 },
  infoToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  info: { fontSize: 13, color: '#555', marginBottom: 4 },
  safety: { fontSize: 13, color: '#B35A00', marginTop: 2 },
});

export default SpotSheet;
