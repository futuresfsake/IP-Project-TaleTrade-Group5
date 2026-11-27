import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,  Linking,
} from 'react-native';
import { dialog } from '../../component/ui/AppDialog';
import { Map as MapView, Camera, Marker } from '@maplibre/maplibre-react-native';
import type { CameraRef } from '@maplibre/maplibre-react-native';
import { List, LocateFixed, MapPin, Star, X } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../component/feed/ui';
import { getAuth } from '@react-native-firebase/auth';
import { MAPTILER_API_KEY } from '@env';
import {
  getActiveSpots, getSpotAvailability, getWishlistBookIds, getSpotIdsForBook, computeMapView,
} from '../../services/map/meetupService';
import type { GroupedBook } from '../../services/map/meetupService';
import SpotSheet from '../../component/map/SpotSheet';
import { getSpots as getListedSpots } from '../../services/feedService';
import SpotList from '../../component/map/SpotList';
import { getUserLocation, haversineKm, sortByDistance } from '../../services/map/locationService';
import type { Coords } from '../../services/map/locationService';
import type { MeetupSpot, PinnedPlace } from '../../types';

const COLORS = {
  primaryBlue: '#6C63A8',
  softPurple: '#7E6FB0',
  creamBg: '#F5E9CF',
  white: '#FFFFFF',
  danger: '#FF6B6B',
  inputBg: '#F9F7F2',
  gold: '#E8A317',
};

const MAP_STYLE = `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_API_KEY}`;
// Gap between the bottom sheet and the edge of the screen.
const SHEET_BOTTOM = 24;
const MARKER_PRESS_GUARD_MS = 500;

const MapScreen = ({ navigation, route }: any) => {
  const insets = useSafeAreaInsets();
  // Set by Book Detail and Feed posts: only the spots offering this book are shown.
  const filterBookId: string | undefined = route?.params?.bookId;
  const filterBookTitle: string | undefined = route?.params?.bookTitle;
  // When the caller already knows which spots to show, they win over the owners lookup.
  const filterSpotIds: string[] | undefined = route?.params?.spotIds;
  // Places a Feed post's owner pinned on the map.
  const pins: PinnedPlace[] = route?.params?.pins ?? [];

  const [spots, setSpots] = useState<MeetupSpot[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [wishlistCounts, setWishlistCounts] = useState<Record<string, number>>({});
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [bookSpotIds, setBookSpotIds] = useState<string[] | null>(null);
  const loadedOnce = useRef(false);
  // On Android a marker tap is also delivered to the map's onPress right after it.
  // Without this guard that second event closes the sheet the marker just opened.
  const lastMarkerPress = useRef(0);

  // The user's position lives in component state only: never persisted, sent or logged.
  const [userPos, setUserPos] = useState<Coords | null>(null);
  const [locStatus, setLocStatus] = useState<'idle' | 'ok' | 'denied' | 'blocked' | 'unavailable'>('idle');
  const [sortNearest, setSortNearest] = useState(false);
  const [showList, setShowList] = useState(false);
  const cameraRef = useRef<CameraRef>(null);
  const centeredOnce = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<MeetupSpot | null>(null);

  // `silent` refreshes in the background without replacing the map with a spinner.
  const loadSpots = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      if (!MAPTILER_API_KEY) {
        throw new Error('MAPTILER_API_KEY is missing from .env.');
      }
      const uid = getAuth().currentUser?.uid;
      const wishlist = uid ? await getWishlistBookIds(uid) : [];
      const [activeSpots, availability, listed] = await Promise.all([
        getActiveSpots(),
        getSpotAvailability(wishlist, uid),
        // Optional: the map still works when the TaleTrade API is unreachable.
        getListedSpots().catch(() => []),
      ]);
      // A pin counts at least the Feed posts at that spot, even if no owner saved it in Settings.
      const merged = { ...availability.counts };
      listed.forEach(s => {
        merged[s.id] = Math.max(merged[s.id] ?? 0, s.listingCount ?? 0);
      });
      setSpots(activeSpots);
      setCounts(merged);
      setWishlistCounts(availability.wishlistCounts);
      setWishlistIds(wishlist);
      setError(null);
      loadedOnce.current = true;
    } catch (e: any) {
      if (!silent) setError(e?.message || 'Could not load meetup spots.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Load on first focus, then refresh quietly each time the tab regains focus
  // (spots/wishlist/books may have changed elsewhere).
  useFocusEffect(
    useCallback(() => {
      loadSpots(loadedOnce.current);
    }, [loadSpots]),
  );

  // Resolve which spots have the filtered book.
  useEffect(() => {
    let cancelled = false;
    if (!filterBookId) {
      setBookSpotIds(null);
      return;
    }
    // A post with only pinned places has no curated spots to show.
    if (filterSpotIds && (filterSpotIds.length > 0 || route?.params?.pins?.length)) {
      setBookSpotIds(filterSpotIds);
      return;
    }
    getSpotIdsForBook(filterBookId)
      .then(ids => !cancelled && setBookSpotIds(ids))
      .catch(() => !cancelled && setBookSpotIds([]));
    return () => {
      cancelled = true;
    };
  }, [filterBookId, filterSpotIds, route?.params?.pins]);

  const locate = useCallback(async (userInitiated: boolean) => {
    const result = await getUserLocation();
    if (result.status === 'ok') {
      setUserPos(result.coords);
      setLocStatus('ok');
      if (userInitiated) {
        cameraRef.current?.flyTo({ center: [result.coords.lng, result.coords.lat], zoom: 14 });
      }
      return;
    }
    setUserPos(null);
    setLocStatus(result.status);
    if (!userInitiated) return;
    if (result.status === 'blocked') {
      dialog.alert(
        'Location is turned off for TaleTrade',
        'Allow location in your phone settings to centre the map on you.',
        [{ text: 'Not now', style: 'cancel' }, { text: 'Open settings', onPress: () => Linking.openSettings() }],
      );
    } else if (result.status === 'denied') {
      dialog.alert('Location not allowed', 'Allow location to centre the map on you and see distances.');
    } else {
      dialog.alert("Can't find you yet", 'Make sure location is turned on on your phone, then try again.');
    }
  }, []);

  // Ask once when the Map screen opens. Failure just leaves the default map.
  useEffect(() => {
    locate(false);
  }, [locate]);

  // Centre on the user once, as soon as both the position and the map exist.
  useEffect(() => {
    if (userPos && !loading && !filterBookId && !centeredOnce.current && cameraRef.current) {
      centeredOnce.current = true;
      cameraRef.current.flyTo({ center: [userPos.lng, userPos.lat], zoom: 14 });
    }
  }, [userPos, loading, filterBookId]);

  const clearFilter = () =>
    navigation.setParams({ bookId: undefined, bookTitle: undefined, spotIds: undefined, pins: undefined });

  const openBook = (b: GroupedBook) => {
    // BookDetailScreen reads id, title, thumbnail and an authors ARRAY from bookData
    // (the same flat shape extractBookFields accepts).
    navigation.navigate('BookDetail', {
      bookData: { id: b.bookId, title: b.title, authors: [b.author], thumbnail: b.thumbnail },
    });
  };

  const openOwner = (ownerId: string) => {
    navigation.navigate('UserProfileView', { userId: ownerId, hideHeader: true });
  };

  const visibleSpots = useMemo(
    () => (filterBookId && bookSpotIds ? spots.filter(s => bookSpotIds.includes(s.id)) : spots),
    [spots, filterBookId, bookSpotIds],
  );
  const distances = useMemo(() => {
    if (!userPos) return null;
    const out: Record<string, number> = {};
    visibleSpots.forEach(s => {
      out[s.id] = haversineKm(userPos, { lat: s.lat, lng: s.lng });
    });
    return out;
  }, [userPos, visibleSpots]);
  const listSpots = useMemo(
    () =>
      sortNearest && distances
        ? sortByDistance(visibleSpots, s => distances[s.id])
        : [...visibleSpots].sort((a, b) => a.name.localeCompare(b.name)),
    [visibleSpots, sortNearest, distances],
  );
  const selectSpot = (spot: MeetupSpot) => {
    setSelected(spot);
    setShowList(false);
    cameraRef.current?.flyTo({ center: [spot.lng, spot.lat], zoom: 15 });
  };
  const hasWishlistSpot = visibleSpots.some(s => (wishlistCounts[s.id] ?? 0) > 0);
  const initialViewState = computeMapView([...visibleSpots, ...pins]);

  const header = (
    <View style={{ paddingTop: insets.top }}>
      <ScreenHeader title="Meetup spots" onBack={() => navigation.goBack()} />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primaryBlue} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.center}>
        <Text style={styles.stateTitle}>Couldn't load the map</Text>
        <Text style={styles.stateText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => loadSpots()}>
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {header}
      <View style={styles.map}>
      <MapView style={styles.map} mapStyle={MAP_STYLE} onPress={() => {
        if (Date.now() - lastMarkerPress.current > MARKER_PRESS_GUARD_MS) setSelected(null);
      }}>
        <Camera
          ref={cameraRef}
          key={[...visibleSpots.map(s => s.id), ...pins.map(p => `${p.lat},${p.lng}`)].join(',')}
          initialViewState={
            'bounds' in initialViewState
              ? { bounds: initialViewState.bounds, padding: { top: 80, right: 60, bottom: 200, left: 60 } }
              : initialViewState
          }
        />
        {userPos && (
          <Marker id="me" lngLat={[userPos.lng, userPos.lat]}>
            <View style={styles.meDot} />
          </Marker>
        )}
        {pins.map((p, i) => (
          <Marker key={`pin-${i}`} id={`pin-${i}`} lngLat={[p.lng, p.lat]} anchor="top" offset={[0, -22]}>
            <View style={styles.pinned}>
              <View style={styles.marker}>
                <MapPin color={COLORS.white} size={22} />
              </View>
              <Text style={styles.pinnedLabel} numberOfLines={1}>{p.name}</Text>
            </View>
          </Marker>
        ))}
        {visibleSpots.map(spot => {
          const wanted = (wishlistCounts[spot.id] ?? 0) > 0;
          return (
          <Marker
            key={spot.id}
            id={spot.id}
            lngLat={[spot.lng, spot.lat]}
            onPress={() => {
              lastMarkerPress.current = Date.now();
              setSelected(spot);
            }}
          >
            {/* Padding leaves room for the count badge inside the marker bounds. */}
            <View style={styles.markerBox}>
            <View style={[styles.marker, wanted && styles.markerWanted]}>
              {wanted ? <Star color={COLORS.white} fill={COLORS.white} size={22} /> : <MapPin color={COLORS.white} size={22} />}
            </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{counts[spot.id] ?? 0}</Text>
              </View>
            </View>
          </Marker>
          );
        })}
      </MapView>

      {filterBookId && (
        <View style={styles.filterChip}>
          <Text style={styles.filterText} numberOfLines={1}>
            Spots with: {filterBookTitle || 'this book'}
          </Text>
          <TouchableOpacity onPress={clearFilter} accessibilityLabel="Clear filter">
            <X color={COLORS.white} size={18} />
          </TouchableOpacity>
        </View>
      )}

      {visibleSpots.length === 0 && pins.length === 0 && (
        <View style={styles.emptyBanner}>
          <Text style={styles.stateText}>
            {filterBookId && bookSpotIds
              ? 'No meetup spots have this book yet.'
              : filterBookId
              ? 'Looking for spots...'
              : 'No meetup spots are available yet.'}
          </Text>
        </View>
      )}

      {hasWishlistSpot && (
        <View style={styles.legend}>
          <Star color={COLORS.gold} fill={COLORS.gold} size={14} />
          <Text style={styles.legendText}>Has a book from your wishlist</Text>
        </View>
      )}

      <View style={styles.fabColumn}>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => locate(true)}
          accessibilityLabel="Centre on my location"
        >
          <LocateFixed color={locStatus === 'ok' ? COLORS.primaryBlue : COLORS.softPurple} size={22} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            setSelected(null);
            setShowList(v => !v);
          }}
          accessibilityLabel="List spots"
        >
          <List color={showList ? COLORS.primaryBlue : COLORS.softPurple} size={22} />
        </TouchableOpacity>
      </View>

      {showList && !selected && (
        <SpotList
          spots={listSpots}
          counts={counts}
          wishlistCounts={wishlistCounts}
          distances={distances}
          sortNearest={sortNearest}
          bottomOffset={SHEET_BOTTOM}
          onToggleSort={() => setSortNearest(v => !v)}
          onSelect={selectSpot}
          onClose={() => setShowList(false)}
        />
      )}

      {selected && (
        <SpotSheet
          spot={selected}
          distanceKm={distances?.[selected.id]}
          wishlistIds={wishlistIds}
          currentUserId={getAuth().currentUser?.uid}
          bottomOffset={SHEET_BOTTOM}
          onClose={() => setSelected(null)}
          onOpenBook={openBook}
          onOpenOwner={openOwner}
        />
      )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.creamBg },
  map: { flex: 1 },
  center: { flex: 1, backgroundColor: COLORS.creamBg, justifyContent: 'center', alignItems: 'center', padding: 30 },
  stateTitle: { fontSize: 20, fontWeight: '800', color: COLORS.primaryBlue, marginBottom: 8 },
  stateText: { fontSize: 14, color: '#777', textAlign: 'center', marginVertical: 8 },
  retryBtn: { marginTop: 12, backgroundColor: COLORS.primaryBlue, paddingVertical: 12, paddingHorizontal: 28, borderRadius: 20 },
  retryText: { color: COLORS.white, fontWeight: '800' },
  emptyBanner: { position: 'absolute', top: 70, alignSelf: 'center', backgroundColor: COLORS.white, borderRadius: 20, paddingHorizontal: 20, elevation: 4 },
  marker: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primaryBlue, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: COLORS.white, elevation: 6 },
  meDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#2F80ED', borderWidth: 3, borderColor: COLORS.white, elevation: 6 },
  fabColumn: { position: 'absolute', right: 16, top: 112, gap: 12 },
  fab: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.white, justifyContent: 'center', alignItems: 'center', elevation: 6 },
  markerWanted: { backgroundColor: COLORS.gold },
  pinned: { alignItems: 'center', width: 140 },
  markerBox: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  pinnedLabel: { marginTop: 2, fontSize: 11, fontWeight: '800', color: '#33354D', backgroundColor: COLORS.white, borderRadius: 8, paddingHorizontal: 6, overflow: 'hidden' },
  filterChip: { position: 'absolute', top: 12, left: 20, right: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.primaryBlue, borderRadius: 20, paddingVertical: 10, paddingHorizontal: 16, elevation: 6 },
  filterText: { flex: 1, color: COLORS.white, fontWeight: '800', marginRight: 10 },
  legend: { position: 'absolute', top: 64, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.white, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12, elevation: 4 },
  legendText: { fontSize: 12, fontWeight: '700', color: '#555' },
  badge: { position: 'absolute', top: 0, right: 0, minWidth: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.danger, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: COLORS.white },
  badgeText: { color: COLORS.white, fontSize: 11, fontWeight: '800' },
});

export default MapScreen;
