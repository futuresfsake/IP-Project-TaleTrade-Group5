// "Meetup spots": choose up to N public places from TaleTrade's own location API.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePreventRemove } from '@react-navigation/native';
import { Map as MapView, Camera, Marker } from '@maplibre/maplibre-react-native';
import type { MapRef } from '@maplibre/maplibre-react-native';
import { dialog } from '../../component/ui/AppDialog';
import { MAPTILER_API_KEY } from '@env';
import { Check, ChevronLeft, MapPin, Search, ShieldCheck, X } from 'lucide-react-native';
import { colors, statusColors } from '../../theme/colors';
import { getPlaceName, getSpots } from '../../services/feedService';
import { ApiError } from '../../services/apiClient';
import { formatDistance, getUserLocation } from '../../services/map/locationService';
import type { Coords } from '../../services/map/locationService';
import { computeMapView, toggleSpotSelection } from '../../services/map/meetupService';
import type { ApiSpot, MeetupSpotType, PinnedPlace } from '../../types';
import { AppButton, Chip, EmptyState, SegmentedControl } from '../../component/feed/ui';

const MAP_STYLE = `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_API_KEY}`;

const PIN_SIZE = 40;
const LOOKING_UP = 'Finding place name…';

const TYPE_FILTERS: Array<{ value: MeetupSpotType | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'mall', label: 'Malls' },
  { value: 'library', label: 'Libraries' },
  { value: 'cafe', label: 'Cafés' },
  { value: 'campus', label: 'Campus' },
  { value: 'bookstore', label: 'Bookstores' },
];

const ChooseSpotsScreen = ({ navigation, route }: any) => {
  const insets = useSafeAreaInsets();
  const max: number = route?.params?.max ?? 3;

  const [spots, setSpots] = useState<ApiSpot[]>([]);
  const [selected, setSelected] = useState<string[]>(route?.params?.selected ?? []);
  const [pins, setPins] = useState<PinnedPlace[]>(route?.params?.pins ?? []);
  // A marker tap also reaches the map underneath on Android; ignore that second event.
  const lastMarkerPress = useRef(0);
  const mapRef = useRef<MapRef>(null);
  const [type, setType] = useState<MeetupSpotType | 'all'>('all');
  const [query, setQuery] = useState('');
  const [coords, setCoords] = useState<Coords | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limitHit, setLimitHit] = useState(false);
  const [mode, setMode] = useState<'list' | 'map'>('list');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSpots(await getSpots({ coords }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load meetup spots.');
    } finally {
      setLoading(false);
    }
  }, [coords]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return spots.filter(
      s =>
        (type === 'all' || s.type === type) &&
        (!q || s.name.toLowerCase().includes(q) || (s.city ?? '').toLowerCase().includes(q)),
    );
  }, [spots, type, query]);

  const mapView = useMemo(() => computeMapView(visible), [visible]);

  // Only offer type chips that exist in the data.
  const presentTypes = useMemo(() => new Set(spots.map(s => s.type)), [spots]);

  const total = selected.length + pins.length;

  const toggle = (id: string) => {
    // Pinned places count towards the same limit as curated spots.
    const result = toggleSpotSelection(selected, id, max - pins.length);
    setSelected(result.spotIds);
    setLimitHit(result.limitReached);
  };

  /** The labelled place under the tap, if the map shows one there. */
  const labelAt = async (point: any): Promise<string | null> => {
    try {
      const features = (await mapRef.current?.queryRenderedFeatures(point)) ?? [];
      const named = features.find(f => f.geometry?.type === 'Point' && (f.properties?.name_en || f.properties?.name));
      return named ? String(named.properties?.name_en || named.properties?.name) : null;
    } catch {
      return null;
    }
  };

  /** Tapping empty map drops a pin there, named after the place. */
  const dropPin = async (event: any) => {
    if (Date.now() - lastMarkerPress.current < 500) return;
    const lngLat = event?.nativeEvent?.lngLat;
    if (!lngLat) return;
    if (total >= max) {
      setLimitHit(true);
      return;
    }
    const [lng, lat] = lngLat;
    setPins(prev => [...prev, { name: LOOKING_UP, lat, lng }]);
    setLimitHit(false);

    // The label on the map first; otherwise ask TaleTrade's API for the address.
    const name =
      (await labelAt(event.nativeEvent.point)) ??
      (await getPlaceName(lat, lng).catch(() => 'Pinned location'));
    // Keep a name the user has typed in the meantime.
    setPins(prev =>
      prev.map(p => (p.lat === lat && p.lng === lng && p.name === LOOKING_UP ? { ...p, name: name.slice(0, 60) } : p)),
    );
  };

  const removePin = (index: number) => {
    const pin = pins[index];
    if (!pin) return;
    dialog.alert('Remove this pin?', pin.name, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setPins(prev => prev.filter(p => p !== pin));
          setLimitHit(false);
        },
      },
    ]);
  };

  const renamePin = (index: number, name: string) =>
    setPins(prev => prev.map((p, i) => (i === index ? { ...p, name } : p)));

  const sortNearest = async () => {
    const result = await getUserLocation();
    if (result.status === 'ok') setCoords(result.coords);
  };

  const confirmed = useRef(false);
  const startKey = useRef(JSON.stringify([route?.params?.selected ?? [], route?.params?.pins ?? []]));
  const changed = JSON.stringify([selected, pins]) !== startKey.current;
  usePreventRemove(changed, ({ data }) => {
    if (confirmed.current) {
      navigation.dispatch(data.action);
      return;
    }
    dialog.alert('Discard your changes?', 'Your place choices have not been confirmed.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  const confirm = () => {
    confirmed.current = true;
    // Hand the choice back to the screen that opened this one.
    // popTo returns to the open form; `navigate` would push a second, empty one.
    const named = pins.map((p, i) => ({ ...p, name: p.name.trim() || `Pinned location ${i + 1}` }));
    navigation.popTo('CreateListing', { spotIds: selected, pins: named }, { merge: true });
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <TouchableOpacity accessibilityLabel="Back" style={styles.back} onPress={() => navigation.goBack()}>
          <ChevronLeft color={colors.accent} size={22} />
        </TouchableOpacity>
        <View style={styles.flex}>
          <Text style={styles.title}>Meetup spots</Text>
          <Text style={styles.subtitle}>Choose up to {max} public places</Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.search}>
          <Search color={colors.muted} size={20} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search malls, libraries, cafés"
            placeholderTextColor={colors.muted}
            autoCorrect={false}
          />
        </View>
      </View>

      <View style={styles.searchWrap}>
        <SegmentedControl
          value={mode}
          onChange={setMode}
          options={[
            { value: 'list', label: 'List' },
            { value: 'map', label: 'Pin on map' },
          ]}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipScroll}>
        {TYPE_FILTERS.filter(f => f.value === 'all' || presentTypes.has(f.value as MeetupSpotType)).map(f => (
          <Chip key={f.value} label={f.label} selected={type === f.value} onPress={() => setType(f.value)} />
        ))}
        <Chip label={coords ? 'Nearest first ✓' : 'Nearest first'} selected={!!coords} onPress={sortNearest} />
      </ScrollView>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      ) : error ? (
        <EmptyState icon={<MapPin color={colors.purple} size={44} />} title="Couldn’t load spots" body={error}>
          <AppButton label="Try again" onPress={load} />
        </EmptyState>
      ) : mode === 'map' ? (
        <View style={styles.mapWrap}>
          <MapView ref={mapRef} style={styles.map} mapStyle={MAP_STYLE} onPress={dropPin}>
            <Camera
              key={visible.map(s => s.id).join(',')}
              initialViewState={
                'bounds' in mapView
                  ? { bounds: mapView.bounds, padding: { top: 60, right: 50, bottom: 60, left: 50 } }
                  : mapView
              }
            />
            {visible.map(s => {
              const on = selected.includes(s.id);
              return (
                <Marker
                  key={s.id}
                  id={s.id}
                  lngLat={[s.lng, s.lat]}
                  // The circle sits on the coordinate; the name hangs below it.
                  anchor="top"
                  offset={[0, -PIN_SIZE / 2]}
                  onPress={() => {
                    lastMarkerPress.current = Date.now();
                    toggle(s.id);
                  }}
                >
                  <View style={styles.pinWrap}>
                    <View style={[styles.pin, on ? styles.pinOn : styles.pinOff]}>
                      {on ? <Check color={colors.white} size={20} strokeWidth={3} /> : <MapPin color={colors.white} size={20} />}
                    </View>
                    <Text style={styles.pinLabel} numberOfLines={1}>{s.name}</Text>
                  </View>
                </Marker>
              );
            })}
            {/* Dropped pins are numbered to match the rows below, so close pins stay readable. */}
            {pins.map((p, i) => (
              <Marker
                key={`${p.lat}-${p.lng}`}
                id={`pin-${p.lat}-${p.lng}`}
                lngLat={[p.lng, p.lat]}
                onPress={() => {
                  lastMarkerPress.current = Date.now();
                  removePin(i);
                }}
              >
                <View style={[styles.pin, styles.pinDropped]}>
                  <Text style={styles.pinNumber}>{i + 1}</Text>
                </View>
              </Marker>
            ))}
          </MapView>
          <View style={styles.mapHint}>
            <Text style={styles.mapHintText}>
              {total === 0 ? 'Tap anywhere to drop a pin, or tap a marker to choose that spot.' : `${total} of ${max} chosen. Tap a marker or pin again to remove it.`}
            </Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={s => s.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Text style={styles.empty}>No spots match your search.</Text>}
          ListFooterComponent={
            <View style={styles.tip}>
              <ShieldCheck color={statusColors.reserved.text} size={22} />
              <Text style={styles.tipText}>Meet in busy public places and let a friend know your plans.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const on = selected.includes(item.id);
            return (
              <TouchableOpacity
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() => toggle(item.id)}
                activeOpacity={0.85}
                style={[styles.row, on && styles.rowOn]}
              >
                <View style={styles.iconTile}>
                  <MapPin color={colors.purple} size={20} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>
                    {[
                      item.type,
                      item.distanceKm !== undefined ? formatDistance(item.distanceKm) : null,
                      `${item.listingCount ?? 0} ${item.listingCount === 1 ? 'book' : 'books'} here`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                {on ? (
                  <View style={styles.checked}>
                    <Check color={colors.white} size={14} strokeWidth={3} />
                  </View>
                ) : (
                  <View style={styles.unchecked} />
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}

      {pins.length > 0 ? (
        <View style={styles.pinList}>
          {pins.map((p, i) => (
            <View key={`${p.lat}-${p.lng}`} style={styles.pinRow}>
              <View style={styles.pinBadge}>
                <Text style={styles.pinBadgeText}>{i + 1}</Text>
              </View>
              <TextInput
                style={styles.pinName}
                value={p.name}
                onChangeText={name => renamePin(i, name)}
                maxLength={60}
                accessibilityLabel={`Name of pinned location ${i + 1}`}
                selectTextOnFocus
              />
              <TouchableOpacity accessibilityLabel="Remove pin" onPress={() => removePin(i)}>
                <X color={colors.muted} size={18} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : null}

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        {limitHit ? <Text style={styles.limit}>You can pick up to {max} places. Remove one to choose another.</Text> : null}
        <AppButton
          label={total === 0 ? 'Pick at least one place' : `Confirm ${total} ${total === 1 ? 'place' : 'places'}`}
          onPress={confirm}
          disabled={total === 0}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingBottom: 12 },
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
  title: { fontSize: 22, fontWeight: '900', color: colors.heading },
  subtitle: { fontSize: 13, color: colors.muted },
  searchWrap: { paddingHorizontal: 20, paddingBottom: 12 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.ink, padding: 0 },
  chipScroll: { flexGrow: 0 },
  chips: { paddingHorizontal: 20, paddingBottom: 12, gap: 8 },
  loader: { marginTop: 60 },
  mapWrap: { flex: 1, marginHorizontal: 20, marginBottom: 12, borderRadius: 24, overflow: 'hidden' },
  map: { flex: 1 },
  mapHint: { position: 'absolute', left: 12, right: 12, bottom: 12, backgroundColor: colors.white, borderRadius: 16, padding: 10, alignItems: 'center' },
  mapHintText: { fontSize: 13, fontWeight: '600', color: colors.body },
  pinWrap: { alignItems: 'center', width: 120 },
  pinNumber: { color: colors.white, fontSize: 16, fontWeight: '900' },
  pinBadge: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  pinBadgeText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  pin: { width: PIN_SIZE, height: PIN_SIZE, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.white },
  pinOn: { backgroundColor: colors.primary },
  pinOff: { backgroundColor: '#B4AECB' },
  pinDropped: { backgroundColor: colors.heading },
  pinList: { paddingHorizontal: 20, paddingBottom: 12, gap: 8 },
  pinRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.white, borderRadius: 16, borderWidth: 1.5, borderColor: colors.primary, paddingHorizontal: 12, height: 48 },
  pinName: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.ink, padding: 0 },
  pinLabel: { marginTop: 2, fontSize: 11, fontWeight: '700', color: colors.ink, backgroundColor: 'rgba(255,255,255,0.85)', paddingHorizontal: 6, borderRadius: 8, overflow: 'hidden' },
  list: { paddingHorizontal: 20, paddingBottom: 20, gap: 8 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 10,
    paddingRight: 12,
  },
  rowOn: { backgroundColor: colors.selected, borderColor: colors.accent, borderWidth: 2 },
  iconTile: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 15, fontWeight: '700', color: colors.ink },
  meta: { fontSize: 12, color: colors.muted, textTransform: 'capitalize' },
  checked: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  unchecked: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.border },
  tip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: statusColors.reserved.bg,
    borderRadius: 16,
    padding: 12,
    marginTop: 8,
  },
  tipText: { flex: 1, fontSize: 13, fontWeight: '500', color: statusColors.reserved.text, lineHeight: 18 },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    backgroundColor: colors.white,
    gap: 8,
    elevation: 12,
    shadowColor: colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -4 },
  },
  limit: { fontSize: 12, fontWeight: '600', color: colors.danger, textAlign: 'center' },
});

export default ChooseSpotsScreen;
