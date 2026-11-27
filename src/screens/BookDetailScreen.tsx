import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  
} from 'react-native';
import { dialog } from '../component/ui/AppDialog';
import { 
  getBookOwners, 
  addBookToUserInventory, 
  addToWishlist 
} from '../services/userbookService';
import { getActiveSpots } from '../services/map/meetupService';
import { findWork } from '../services/nearbyService';
import { useNearby } from '../component/useNearby';
import { getAuth } from '@react-native-firebase/auth';
import { getBookDetails } from '../services/feedService';
import BookMapPreview from '../component/map/BookMapPreview';
import { AppButton, Avatar, BackButton, BookCover } from '../component/feed/ui';
import { colors, shadow, statusColors } from '../theme/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight } from 'lucide-react-native';
import type { BookOwner, MeetupSpot } from '../types';

const BookDetailScreen = ({ route, navigation }: any) => {
  const insets = useSafeAreaInsets();
  // Reloads on focus, so adding the book (or a new listing) shows up.
  const nearby = useNearby();
  const bookData = route?.params?.bookData;

  const [owners, setOwners] = useState<any[]>([]);
  const [activeSpots, setActiveSpots] = useState<MeetupSpot[]>([]);
  const [apiDescription, setApiDescription] = useState('');
  const [loadingAction, setLoadingAction] = useState(false);

  const bookId = bookData?.id;
  const volumeInfo = bookData?.volumeInfo || {};
  
  const title = volumeInfo.title || bookData?.title || 'Untitled Book';
  const knownDescription = volumeInfo.description || bookData?.description || apiDescription;
  const description = knownDescription || 'No description available.';
  const thumbnail = volumeInfo.imageLinks?.thumbnail || bookData?.thumbnail;
  
  const rawAuthors = volumeInfo.authors || bookData?.authors;
  const authorText = Array.isArray(rawAuthors) ? rawAuthors.join(', ') : 'Unknown Author';

  const fetchOwners = async () => {
    if (!bookId) return;
    try {
      const data = await getBookOwners(bookId);
      setOwners(data);
    } catch (err) {
      console.log("Error fetching owners from Firestore:", err);
    }
  };

  useEffect(() => {
    fetchOwners();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  useEffect(() => {
    // Spots are a nice-to-have; owners still show if this fails.
    getActiveSpots()
      .then(setActiveSpots)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!bookId) return;
    // Books opened from the Feed have no description of their own.
    getBookDetails(bookId)
      .then(details => setApiDescription(details.book.description))
      .catch(() => {});
  }, [bookId]);

  const myUid = getAuth().currentUser?.uid;
  // Owners of every edition, from the same data as the "nearby" badges in Search.
  const work = nearby ? findWork(nearby.works, { id: bookId, title, author: authorText }) : undefined;

  /** Falls back to this edition's owners in Firestore when the API can't be reached. */
  const listedOwners: BookOwner[] = nearby
    ? work?.owners ?? []
    : owners.map(o => ({
        id: o.id,
        username: o.username,
        photoURL: o.photo,
        listing: null,
        spots: activeSpots
          .filter(s => (o.spotIds || []).includes(s.id))
          .map(s => ({ ...s, safetyNote: s.safetyNote ?? null })),
      }));
  const sortedOwners = [...listedOwners].sort((a, b) => Number(b.id === myUid) - Number(a.id === myUid));
  const nearbyCount = nearby ? nearby.countFor({ id: bookId, title, author: authorText }) : 0;

  // Every place this book can be picked up, once each.
  const bookSpots = Array.from(new Map(listedOwners.flatMap(o => o.spots).map(s => [s.id, s])).values());
  // With nothing set for this book, the map still shows the public meetup spots.
  const mapSpots = bookSpots.length > 0 ? bookSpots : activeSpots;

  const handleViewOnMap = () => {
    if (bookSpots.length === 0) {
      navigation.navigate('Map');
      return;
    }
    navigation.navigate('Map', {
      bookId,
      bookTitle: title,
      spotIds: bookSpots.filter(s => !s.custom).map(s => s.id),
      pins: bookSpots.filter(s => s.custom).map(({ name, lat, lng }) => ({ name, lat, lng })),
    });
  };

  /** Keeps the description fetched from the API when the book is saved. */
  const withDescription = () =>
    bookData.volumeInfo || bookData.description || !apiDescription
      ? bookData
      : { ...bookData, description: apiDescription };

  const handleAddBook = async () => {
    if (!bookData) return;
    setLoadingAction(true);
    try {
      await addBookToUserInventory(withDescription());
      dialog.alert("Success", "Book added to your inventory!");
      await fetchOwners();
      await nearby?.refresh?.();
    } catch {
      dialog.alert("Error", "Could not add book. Please try again.");
    } finally {
      setLoadingAction(false);
    }
  };

  const handleWishlist = async () => {
    if (!bookData) return;
    try {
      await addToWishlist(withDescription());
      dialog.alert("Wishlist", "Added to your hearts!");
    } catch {
      dialog.alert("Error", "Could not add to wishlist.");
    }
  };

  if (!bookData) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.missing}>No book context parameters detected.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingTop: insets.top }} showsVerticalScrollIndicator={false}>
      <View style={styles.topBar}>
        <BackButton onPress={() => navigation.goBack()} />
      </View>

      <View style={styles.hero}>
        <View style={styles.coverShadow}>
          <BookCover uri={thumbnail} width={150} height={224} radius={18} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.author}>{authorText}</Text>
      </View>

      <View style={styles.buttonRow}>
        <AppButton variant="secondary" label="Wishlist" onPress={handleWishlist} style={styles.action} />
        <AppButton label="I own this" onPress={handleAddBook} loading={loadingAction} style={styles.action} />
      </View>

      <View style={styles.about}>
        <Text style={styles.sectionTitle}>About this book</Text>
        <Text style={styles.description}>{description}</Text>
      </View>

      {mapSpots.length > 0 && (
        <BookMapPreview
          spots={mapSpots}
          note={bookSpots.length === 0 ? 'No owner has set a meetup place for this book yet. These are the public meetup spots.' : undefined}
          onPress={handleViewOnMap}
        />
      )}

      <View style={styles.owners}>
        <Text style={styles.sectionTitle}>Users who own this book</Text>
        {nearbyCount > 0 ? (
          <Text style={styles.nearbyNote}>{nearbyCount} {nearbyCount === 1 ? 'owner' : 'owners'} nearby</Text>
        ) : null}
        {sortedOwners.length > 0 ? (
          sortedOwners.map(owner => (
            <TouchableOpacity
              key={owner.id}
              style={styles.ownerRow}
              onPress={() => {
                // PASS hideHeader PARAMETER HERE
                navigation.push('UserProfileView', { userId: owner.id, hideHeader: true });
              }}
            >
              <Avatar name={owner.username || 'U'} uri={owner.photoURL?.replace('http://', 'https://')} size={40} />
              <View style={styles.ownerText}>
                <Text style={styles.ownerName}>{owner.id === myUid ? 'You' : owner.username}</Text>
                {owner.spots.length > 0 && (
                  <Text style={styles.ownerSpots} numberOfLines={2}>{owner.spots.map(s => s.name).join(', ')}</Text>
                )}
              </View>
              {nearby?.isOwnerNearby(owner) ? <Text style={styles.nearbyPill}>Nearby</Text> : null}
              <ChevronRight color={colors.muted} size={18} />
            </TouchableOpacity>
          ))
        ) : (
          <Text style={styles.noOwners}>Be the first to own this!</Text>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  centered: { justifyContent: 'center', alignItems: 'center' },
  missing: { color: colors.ink, fontWeight: 'bold' },
  topBar: { paddingHorizontal: 20, paddingTop: 8, alignItems: 'flex-start' },
  hero: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },
  coverShadow: { borderRadius: 18, backgroundColor: colors.cover, elevation: 8 },
  title: { fontSize: 26, fontWeight: '900', color: colors.heading, textAlign: 'center', marginTop: 18 },
  author: { fontSize: 16, fontWeight: '600', color: colors.purple, marginTop: 4, textAlign: 'center' },
  buttonRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingBottom: 20 },
  action: { flex: 1 },
  about: { paddingHorizontal: 20, paddingBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.heading, marginBottom: 10 },
  description: { color: colors.body, lineHeight: 22, fontSize: 14 },
  owners: { padding: 16, marginHorizontal: 20, marginBottom: 40, backgroundColor: colors.white, borderRadius: 20, ...shadow },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  ownerText: { flex: 1 },
  ownerName: { fontSize: 15, fontWeight: '700', color: colors.ink },
  ownerSpots: { fontSize: 12, color: colors.muted, marginTop: 2 },
  nearbyNote: { fontSize: 13, fontWeight: '700', color: statusColors.available.text, marginTop: -6, marginBottom: 4 },
  nearbyPill: { fontSize: 11, fontWeight: '700', color: statusColors.available.text, backgroundColor: statusColors.available.bg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden' },
  noOwners: { fontStyle: 'italic', color: colors.muted },
});

export default BookDetailScreen;