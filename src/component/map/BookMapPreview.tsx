// "Where to meet" card on Book Detail: a still map with pins for the spots offering a book.
// Tapping it opens the full Map screen.
import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Map as MapView, Camera, Marker } from '@maplibre/maplibre-react-native';
import { ChevronRight, MapPin } from 'lucide-react-native';
import { MAPTILER_API_KEY } from '@env';
import { computeMapView } from '../../services/map/meetupService';
import { colors } from '../../theme/colors';

const MAP_STYLE = `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_API_KEY}`;

interface BookMapPreviewProps {
  /** Spots offering the book, most relevant first. */
  spots: Array<{ id: string; name: string; lat: number; lng: number }>;
  /** Explains the pins when they are not specific to this book. */
  note?: string;
  onPress: () => void;
}

const BookMapPreview = ({ spots, note, onPress }: BookMapPreviewProps) => {
  const view = useMemo(() => computeMapView(spots), [spots]);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Where to meet</Text>
      {note ? <Text style={styles.note}>{note}</Text> : null}

      {MAPTILER_API_KEY ? (
        <View style={styles.mapWrap}>
          <MapView style={styles.map} mapStyle={MAP_STYLE}>
            <Camera
              key={spots.map(s => s.id).join(',')}
              initialViewState={
                'bounds' in view ? { bounds: view.bounds, padding: { top: 36, right: 36, bottom: 24, left: 36 } } : view
              }
            />
            {spots.map(s => (
              <Marker key={s.id} id={s.id} lngLat={[s.lng, s.lat]}>
                <View style={styles.pin}>
                  <MapPin color="#FFFFFF" size={16} />
                </View>
              </Marker>
            ))}
          </MapView>
          {/* Covers the map so it never steals the page's scroll gestures. */}
          <TouchableOpacity
            style={styles.cover}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={`Open the meetup map: ${spots.map(s => s.name).join(', ')}`}
          >
            <View style={styles.hint}>
              <Text style={styles.hintText}>Tap to open</Text>
              <ChevronRight color="#6C63A8" size={14} />
            </View>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.hint} onPress={onPress} accessibilityRole="button">
          <Text style={styles.hintText}>Open map</Text>
          <ChevronRight color="#6C63A8" size={14} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { padding: 16, marginHorizontal: 20, backgroundColor: '#FFF', borderRadius: 20, marginBottom: 16, elevation: 2 },
  title: { fontSize: 18, fontWeight: '800', marginBottom: 10, color: colors.heading },
  mapWrap: { height: 160, borderRadius: 16, overflow: 'hidden', backgroundColor: '#E4EBE1' },
  map: { flex: 1 },
  note: { fontSize: 12, color: '#8A8FA3', marginTop: -4, marginBottom: 10 },
  cover: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'flex-end', justifyContent: 'flex-end', padding: 8 },
  pin: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#6C63A8', borderWidth: 2, borderColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  hint: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 2, backgroundColor: '#FFF', borderRadius: 12, paddingLeft: 10, paddingRight: 6, paddingVertical: 4 },
  hintText: { fontSize: 12, fontWeight: '700', color: '#6C63A8' },
});

export default BookMapPreview;
