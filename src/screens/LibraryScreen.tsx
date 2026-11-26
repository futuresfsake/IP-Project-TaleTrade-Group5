// Library tab: "My Books" and "Wishlist" on one page, switched by a segmented control.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator,  FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { dialog } from '../component/ui/AppDialog';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAuth } from '@react-native-firebase/auth';
import { getFirestore, collection, onSnapshot } from '@react-native-firebase/firestore';
import { BookOpen, Ellipsis, Heart, Pencil, Share2, Trash2 } from 'lucide-react-native';
import { getUserInventory, removeBookFromInventory, removeFromWishlist } from '../services/userbookService';
import { getMyLibrary } from '../services/feedService';
import { listingPill, newestFirst, ownersPill } from '../services/feedHelpers';
import ActionMenu from '../component/ui/ActionMenu';
import type { MenuAnchor, MenuItem } from '../component/ui/ActionMenu';
import { useNearby } from '../component/useNearby';
import type { PillInfo } from '../services/feedHelpers';
import { colors, shadow, statusColors } from '../theme/colors';
import type { LibraryBook } from '../types';
import { AppButton, BookCover, EmptyState, ScreenHeader, SegmentedControl } from '../component/feed/ui';

type LibraryTab = 'books' | 'wishlist';

const reconstructBookData = (item: any) => ({
  id: item.bookId || item.id,
  volumeInfo: {
    title: item.title,
    authors: item.author ? item.author.split(', ') : [],
    description: item.description || '',
    imageLinks: { thumbnail: item.thumbnail || null },
  },
});

const Pill = ({ info }: { info: PillInfo }) => {
  const palette = statusColors[info.tone];
  return (
    <View style={[styles.pill, { backgroundColor: palette.bg }]}>
      <Text style={[styles.pillText, { color: palette.text }]}>{info.label}</Text>
    </View>
  );
};

const LibraryScreen = ({ navigation, route }: any) => {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<LibraryTab>('books');

  const [books, setBooks] = useState<any[]>([]);
  // null while unknown (or when the TaleTrade API is unreachable): no listing status is shown then.
  const [listings, setListings] = useState<Record<string, LibraryBook['listing']> | null>(null);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [wishes, setWishes] = useState<any[]>([]);
  const [loadingWishes, setLoadingWishes] = useState(true);
  const nearby = useNearby();
  const [menu, setMenu] = useState<{ item: any; anchor: MenuAnchor } | null>(null);
  // The ⋯ buttons, so the dropdown can open next to the one that was tapped.
  const menuButtons = useRef<Record<string, View | null>>({});

  // Another screen can ask for a specific side, e.g. { tab: 'wishlist' }.
  useEffect(() => {
    if (!route?.params?.tab) return;
    setTab(route.params.tab);
    navigation.setParams({ tab: undefined });
  }, [route?.params?.tab, navigation]);

  const loadBooks = useCallback(async () => {
    try {
      setBooks(newestFirst((await getUserInventory()) as any[]));
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingBooks(false);
      setRefreshing(false);
    }
    try {
      const library = await getMyLibrary();
      setListings(Object.fromEntries(library.map(b => [b.bookId, b.listing])));
    } catch {
      setListings(null);
    }
  }, []);

  // Reload on every visit, so books and listings changed elsewhere show up.
  useFocusEffect(
    useCallback(() => {
      loadBooks();
    }, [loadBooks]),
  );

  useEffect(() => {
    const userId = getAuth().currentUser?.uid;
    if (!userId) {
      setLoadingWishes(false);
      return;
    }
    return onSnapshot(collection(getFirestore(), 'Users', userId, 'wishlist'), snapshot => {
      if (snapshot) setWishes(newestFirst(snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }))));
      setLoadingWishes(false);
    });
  }, []);

  const openBook = (item: any) => navigation.navigate('BookDetail', { bookData: reconstructBookData(item) });

  const confirmRemoveBook = (id: string) => {
    dialog.alert('Remove Tale', 'Remove this book from your shelf? 🥺', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            setBooks(prev => prev.filter(book => book.id !== id));
            await removeBookFromInventory(id);
          } catch {
            loadBooks();
          }
        },
      },
    ]);
  };

  const openMenu = (item: any) => {
    menuButtons.current[item.id]?.measureInWindow((x, y, width, height) =>
      setMenu({ item, anchor: { x, y, width, height } }),
    );
  };

  const menuItems = (item: any): MenuItem[] => {
    const listing = listings?.[item.id];
    const items: MenuItem[] = [];
    if (listing) {
      items.push({
        label: 'Edit listing',
        icon: <Pencil color={colors.primary} size={18} />,
        onPress: () => navigation.navigate('Feed', { editListingId: listing.id }),
      });
    } else if (listings) {
      items.push({
        label: 'List on Feed',
        icon: <Share2 color={colors.primary} size={18} />,
        onPress: () => navigation.navigate('CreateListing', { bookId: item.id }),
      });
    }
    items.push({
      label: 'Remove book',
      destructive: true,
      icon: <Trash2 color={colors.danger} size={18} />,
      onPress: () => confirmRemoveBook(item.id),
    });
    return items;
  };

  const confirmRemoveWish = (bookId: string) => {
    dialog.alert('Remove Wish', 'Remove this from your wishlist? 💖', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          removeFromWishlist(bookId).catch(() => dialog.alert('Error', 'Could not remove it. Please try again.'));
        },
      },
    ]);
  };

  const onBooks = tab === 'books';
  const data = onBooks ? books : wishes;
  const loading = onBooks ? loadingBooks : loadingWishes;
  const count = `${data.length} ${data.length === 1 ? 'book' : 'books'}`;

  const renderItem = ({ item }: { item: any }) => {
    const listing = listings?.[item.id];
    return (
      <TouchableOpacity style={styles.card} onPress={() => openBook(item)} activeOpacity={0.85}>
        <BookCover uri={item.thumbnail} width={60} height={88} />
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={2}>{item.title || 'Untitled'}</Text>
          <Text style={styles.author} numberOfLines={1}>{item.author || 'Unknown'}</Text>
          {onBooks ? (
            listings ? <Pill info={listingPill(listing?.status ?? null)} /> : null
          ) : nearby?.hasSpots ? (
            <Pill info={ownersPill(nearby.countFor({ id: item.id, title: item.title, author: item.author }))} />
          ) : null}
        </View>
        {onBooks ? (
          <View ref={node => { menuButtons.current[item.id] = node; }} collapsable={false}>
            <TouchableOpacity style={styles.iconButton} accessibilityLabel="More options" onPress={() => openMenu(item)}>
              <Ellipsis color={colors.muted} size={22} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.iconButton} accessibilityLabel="Remove from wishlist" onPress={() => confirmRemoveWish(item.id)}>
            <Heart color={colors.danger} fill={colors.danger} size={22} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Library" subtitle={onBooks ? `${count} on your shelf` : `${count} you want`} />
      <View style={styles.segment}>
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { value: 'books', label: 'My Books' },
            { value: 'wishlist', label: 'Wishlist' },
          ]}
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            onBooks ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  loadBooks();
                }}
                tintColor={colors.primary}
              />
            ) : undefined
          }
          ListEmptyComponent={
            <EmptyState
              icon={<BookOpen color={colors.purple} size={44} />}
              title={onBooks ? 'Your shelf is empty' : 'No wishlisted books yet'}
              body={onBooks ? 'Add the books you own so you can list them.' : 'Save books you want and see who has them.'}
            >
              <AppButton label="Find books" onPress={() => navigation.navigate('Search')} />
            </EmptyState>
          }
        />
      )}
      <ActionMenu anchor={menu?.anchor ?? null} items={menu ? menuItems(menu.item) : []} onClose={() => setMenu(null)} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  segment: { paddingHorizontal: 20, paddingBottom: 12 },
  loader: { marginTop: 60 },
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 130, gap: 12 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: 20, backgroundColor: colors.white, ...shadow },
  info: { flex: 1, gap: 4 },
  title: { fontSize: 16, fontWeight: '800', color: colors.ink },
  author: { fontSize: 13, color: colors.muted },
  pill: { alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  pillText: { fontSize: 12, fontWeight: '700' },
  iconButton: { padding: 8 },
});

export default LibraryScreen;
