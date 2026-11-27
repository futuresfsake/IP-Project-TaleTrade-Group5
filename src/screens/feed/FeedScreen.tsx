// Feed tab: what readers near you are sharing (Community) and the books you list (My listings).
// All data comes from TaleTrade's own API (see src/services/feedService.ts).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { dialog } from '../../component/ui/AppDialog';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, Rss } from 'lucide-react-native';
import { colors, shadow } from '../../theme/colors';
import {
  deleteListing,
  getFeed,
  getMyListings,
  getSpots,
  updateListing,
} from '../../services/feedService';
import { ApiError } from '../../services/apiClient';
import { emptyFeedCopy, toBookData } from '../../services/feedHelpers';
import { getUserLocation } from '../../services/map/locationService';
import type { Coords } from '../../services/map/locationService';
import { addToWishlist, removeFromWishlist } from '../../services/userbookService';
import type { ApiSpot, FeedFilter, FeedItem, ListingPatch, ListingStatus, MyListings } from '../../types';
import ListingCard from '../../component/feed/ListingCard';
import MyListingCard from '../../component/feed/MyListingCard';
import EditListingSheet from '../../component/feed/EditListingSheet';
import ConfirmDialog from '../../component/feed/ConfirmDialog';
import ListingPreviewModal from '../../component/feed/ListingPreviewModal';
import { AppButton, Chip, EmptyState, SegmentedControl } from '../../component/feed/ui';

type FeedTab = 'community' | 'mine';

const FILTERS: Array<{ value: FeedFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'available', label: 'Available' },
  { value: 'nearby', label: 'Near me' },
  { value: 'wishlist', label: 'Wishlist matches' },
];

const messageOf = (error: unknown) =>
  error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';

const FeedScreen = ({ navigation, route }: any) => {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  const [tab, setTab] = useState<FeedTab>('community');
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [coords, setCoords] = useState<Coords | null>(null);

  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cursorRef = useRef<number | null>(null);
  const requestRef = useRef(0);

  const [mine, setMine] = useState<MyListings | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [spots, setSpots] = useState<ApiSpot[]>([]);
  const [editing, setEditing] = useState<FeedItem | null>(null);
  const [removing, setRemoving] = useState<FeedItem | null>(null);
  const [viewing, setViewing] = useState<FeedItem | null>(null);
  const [saving, setSaving] = useState(false);

  // Short confirmation after bookmarking, with a shortcut to where it went.
  const [toast, setToast] = useState<{ text: string; view: boolean } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // ------------------------------------------------------------------ data loading
  const loadCommunity = useCallback(
    async (mode: 'initial' | 'refresh' | 'more') => {
      const id = mode === 'more' ? requestRef.current : ++requestRef.current;
      if (mode === 'more') {
        if (cursorRef.current === null) return;
        setLoadingMore(true);
      } else if (mode === 'refresh') {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const page = await getFeed({
          filter,
          coords,
          cursor: mode === 'more' ? cursorRef.current : null,
        });
        if (id !== requestRef.current) return; // a newer request superseded this one
        cursorRef.current = page.nextCursor;
        setItems(prev => (mode === 'more' ? [...prev, ...page.items.filter(n => !prev.some(p => p.id === n.id))] : page.items));
        setError(null);
      } catch (e) {
        if (id !== requestRef.current) return;
        if (mode !== 'more') setItems([]);
        setError(messageOf(e));
      } finally {
        if (id === requestRef.current) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [filter, coords],
  );

  const loadMine = useCallback(async (mode: 'initial' | 'refresh') => {
    requestRef.current += 1; // drop any community request still in flight
    mode === 'refresh' ? setRefreshing(true) : setLoading(true);
    try {
      setMine(await getMyListings());
      setError(null);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Reload whenever the tab/filter changes or the screen regains focus (e.g. after posting).
  useEffect(() => {
    if (!isFocused) return;
    if (tab === 'community') loadCommunity('initial');
    else loadMine('initial');
  }, [isFocused, tab, loadCommunity, loadMine]);

  const onRefresh = () => (tab === 'community' ? loadCommunity('refresh') : loadMine('refresh'));

  // ---------------------------------------------------------------------- filters
  const selectFilter = async (next: FeedFilter) => {
    if (next === filter) return;
    if (next === 'nearby' && !coords) {
      const result = await getUserLocation();
      if (result.status !== 'ok') {
        dialog.alert('Location needed', 'Turn on location access to see books near you.');
        return;
      }
      setCoords(result.coords);
    }
    setFilter(next);
  };

  // ---------------------------------------------------------------- card actions
  const openBook = (item: FeedItem) => navigation.navigate('BookDetail', { bookData: toBookData(item.book) });
  const openOwner = (item: FeedItem) => navigation.navigate('UserProfileView', { userId: item.owner.id, hideHeader: true });
  const showOnMap = (item: FeedItem) =>
    navigation.navigate('Map', {
      bookId: item.book.id,
      bookTitle: item.book.title,
      spotIds: item.spots.filter(s => !s.custom).map(s => s.id),
      pins: item.spots.filter(s => s.custom).map(({ name, lat, lng }) => ({ name, lat, lng })),
    });

  /** The bookmark toggles the book on your wishlist (Library → Wishlist). */
  const saveToWishlist = (item: FeedItem) => {
    if (!item.wishlisted) {
      setWishlisted(item, true);
      return;
    }
    dialog.alert('Remove from wishlist?', item.book.title, [
      { text: 'Keep', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => setWishlisted(item, false) },
    ]);
  };

  const setWishlisted = async (item: FeedItem, saved: boolean) => {
    const mark = (value: boolean) =>
      setItems(prev => prev.map(i => (i.book.id === item.book.id && !i.isMine ? { ...i, wishlisted: value } : i)));
    mark(saved);
    try {
      if (saved) await addToWishlist(toBookData(item.book));
      else await removeFromWishlist(item.book.id);
      setToast(saved ? { text: 'Saved to your wishlist', view: true } : { text: 'Removed from your wishlist', view: false });
    } catch {
      mark(!saved);
      dialog.alert('Error', 'Could not update your wishlist.');
    }
  };

  // ----------------------------------------------------------- my-listing actions
  // Keeps both tabs in sync after an edit: hidden listings leave the community list.
  const applyListing = (updated: FeedItem) => {
    setMine(prev => {
      if (!prev) return prev;
      const next = prev.items.map(i => (i.id === updated.id ? updated : i));
      return { items: next, summary: summarize(next) };
    });
    setItems(prev =>
      updated.status === 'unavailable'
        ? prev.filter(i => i.id !== updated.id)
        : prev.map(i => (i.id === updated.id ? updated : i)),
    );
  };

  const toggleAvailability = (item: FeedItem, next: ListingStatus) => {
    if (next !== 'unavailable') {
      changeAvailability(item, next);
      return;
    }
    dialog.alert('Hide this listing?', 'Readers won’t see it in the Feed until you turn it back on.', [
      { text: 'Keep visible', style: 'cancel' },
      { text: 'Hide', style: 'destructive', onPress: () => changeAvailability(item, next) },
    ]);
  };

  const changeAvailability = async (item: FeedItem, next: ListingStatus) => {
    setBusyId(item.id);
    try {
      applyListing(await updateListing(item.id, { status: next }));
    } catch (e) {
      dialog.alert('Could not update', messageOf(e));
    } finally {
      setBusyId(null);
    }
  };

  const openEditor = async (item: FeedItem) => {
    setEditing(item);
    if (spots.length === 0) {
      try {
        setSpots(await getSpots());
      } catch {
        // The sheet still works with the listing's own spots.
      }
    }
  };

  const saveEdit = async (item: FeedItem, patch: ListingPatch) => {
    setSaving(true);
    try {
      applyListing(await updateListing(item.id, patch));
      setEditing(null);
    } catch (e) {
      dialog.alert('Could not save', messageOf(e));
    } finally {
      setSaving(false);
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    setSaving(true);
    try {
      await deleteListing(removing.id);
      const gone = removing.id;
      setMine(prev => {
        if (!prev) return prev;
        const next = prev.items.filter(i => i.id !== gone);
        return { items: next, summary: summarize(next) };
      });
      setItems(prev => prev.filter(i => i.id !== gone));
      setRemoving(null);
      setEditing(null);
    } catch (e) {
      dialog.alert('Could not remove', messageOf(e));
    } finally {
      setSaving(false);
    }
  };

  const startListing = () => navigation.navigate('CreateListing');

  // "Edit listing" in the Library lands here: show My listings, then open that listing's editor.
  const editListingId: string | undefined = route?.params?.editListingId;
  useEffect(() => {
    if (editListingId) setTab('mine');
  }, [editListingId]);
  useEffect(() => {
    if (!editListingId || tab !== 'mine' || loading || !mine) return;
    const target = mine.items.find(i => i.id === editListingId);
    navigation.setParams({ editListingId: undefined });
    if (target) openEditor(target);
    // openEditor is recreated on every render; the id guard above makes this run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editListingId, tab, loading, mine]);

  // An empty list already offers "List a book", so the header button would repeat it.
  const showAdd = loading || (tab === 'community' ? items.length > 0 : (mine?.items.length ?? 0) > 0);

  // ---------------------------------------------------------------------- render
  const header = (
    <View>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.flex}>
          <Text style={styles.title}>Feed</Text>
          <Text style={styles.subtitle}>
            {tab === 'community' ? 'What readers near you are sharing' : 'Manage the books you’re sharing'}
          </Text>
        </View>
        {showAdd ? (
          <TouchableOpacity accessibilityLabel="List a book" style={styles.add} onPress={startListing} activeOpacity={0.85}>
            <Plus color={colors.white} size={22} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.pad}>
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { value: 'community', label: 'Community' },
            { value: 'mine', label: 'My listings' },
          ]}
        />
      </View>

      {tab === 'community' ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {FILTERS.map(f => (
              <Chip key={f.value} label={f.label} selected={filter === f.value} onPress={() => selectFilter(f.value)} />
            ))}
          </ScrollView>
        </>
      ) : mine ? (
        <View style={styles.stats}>
          {[
            [mine.summary.listed, 'Listed'],
            [mine.summary.available, 'Available'],
            [mine.summary.reserved, 'Reserved'],
          ].map(([n, label]) => (
            <View key={label} style={styles.stat}>
              <Text style={styles.statNumber}>{n}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );

  const empty = () => {
    if (loading) return <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />;
    if (error) {
      return (
        <EmptyState icon={<Rss color={colors.purple} size={48} strokeWidth={1.8} />} title="Couldn’t load the Feed" body={error}>
          <AppButton label="Try again" onPress={onRefresh} />
        </EmptyState>
      );
    }
    if (tab === 'mine') {
      return (
        <EmptyState
          icon={<Rss color={colors.purple} size={48} strokeWidth={1.8} />}
          title="You haven’t listed any books"
          body="List a book from your library so readers near you can find it."
        >
          <AppButton label="List a book" onPress={startListing} />
        </EmptyState>
      );
    }
    const copy = emptyFeedCopy(filter);
    return (
      <EmptyState icon={<Rss color={colors.purple} size={48} strokeWidth={1.8} />} title={copy.title} body={copy.body}>
        <AppButton label="List a book" onPress={startListing} />
        <AppButton variant="ghost" label="Edit my meetup spots" onPress={() => navigation.navigate('Profile', { screen: 'Settings', initial: false })} />
      </EmptyState>
    );
  };

  const data = tab === 'community' ? items : mine?.items ?? [];

  return (
    <View style={styles.container}>
      <FlatList<FeedItem>
        data={data}
        keyExtractor={i => i.id}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : null}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Separator}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        onEndReachedThreshold={0.4}
        onEndReached={() => tab === 'community' && !loading && loadCommunity('more')}
        renderItem={({ item }) =>
          tab === 'community' ? (
            <View style={styles.pad}>
              <ListingCard item={item} onOpenBook={openBook} onOpenOwner={openOwner} onRequestMeetup={showOnMap} onSave={saveToWishlist} onEdit={openEditor} />
            </View>
          ) : (
            <View style={styles.pad}>
              <MyListingCard item={item} busy={busyId === item.id} onToggle={toggleAvailability} onEdit={openEditor} onView={setViewing} />
            </View>
          )
        }
      />

      {toast ? (
        <View style={styles.toast} accessibilityLiveRegion="polite">
          <Text style={styles.toastText}>{toast.text}</Text>
          {toast.view ? (
            <TouchableOpacity
              onPress={() => {
                setToast(null);
                navigation.navigate('Library', { tab: 'wishlist' });
              }}
            >
              <Text style={styles.toastAction}>View</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <ListingPreviewModal
        item={viewing}
        onClose={() => setViewing(null)}
        onOpenBook={item => {
          setViewing(null);
          openBook(item);
        }}
        onEdit={item => {
          setViewing(null);
          openEditor(item);
        }}
      />
      <EditListingSheet
        item={removing ? null : editing}
        spots={spots}
        saving={saving}
        onClose={() => setEditing(null)}
        onSave={saveEdit}
        onRemove={setRemoving}
      />
      <ConfirmDialog
        visible={!!removing}
        title="Remove this listing?"
        body={`“${removing?.book.title ?? ''}” will disappear from the Feed. The book stays in your library.`}
        confirmLabel="Remove listing"
        cancelLabel="Keep listing"
        loading={saving}
        onConfirm={confirmRemove}
        onCancel={() => setRemoving(null)}
      />
    </View>
  );
};

const summarize = (items: FeedItem[]) => ({
  listed: items.length,
  available: items.filter(i => i.status === 'available').length,
  reserved: items.filter(i => i.status === 'reserved').length,
});

const Separator = () => <View style={styles.separator} />;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.cream },
  list: { paddingBottom: 130 },
  pad: { paddingHorizontal: 20 },
  separator: { height: 14 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: colors.accent },
  subtitle: { fontSize: 14, color: colors.muted },
  add: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  chips: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14, gap: 8 },
  toast: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 104,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.ink,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 48,
    elevation: 8,
  },
  toastText: { color: colors.white, fontSize: 14, fontWeight: '600' },
  toastAction: { color: '#C9C3F5', fontSize: 14, fontWeight: '800', paddingHorizontal: 4 },
  stats: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14 },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 16, backgroundColor: colors.white, ...shadow },
  statNumber: { fontSize: 22, fontWeight: '900', color: colors.accent },
  statLabel: { fontSize: 12, fontWeight: '600', color: colors.muted },
  loader: { marginTop: 40 },
});

export default FeedScreen;
