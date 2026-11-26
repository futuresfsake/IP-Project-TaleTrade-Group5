// Bottom sheet to edit a listing's availability, meetup locations and available times.
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MapPin, X } from 'lucide-react-native';
import { colors, statusColors } from '../../theme/colors';
import {
  MAX_LISTING_SPOTS,
  MAX_TIMES_LENGTH,
  STATUS_LABELS,
  toggleInList,
} from '../../services/feedHelpers';
import type { ApiSpot, FeedItem, ListingPatch, ListingStatus } from '../../types';

/** Pinned places are identified by the server as pin-1, pin-2, ... */
const isPin = (id: string) => id.startsWith('pin-');
import { AppButton, BookCover, Chip } from './ui';
import { dialog } from '../ui/AppDialog';

interface EditListingSheetProps {
  item: FeedItem | null;
  spots: ApiSpot[];
  saving?: boolean;
  onClose: () => void;
  onSave: (item: FeedItem, patch: ListingPatch) => void;
  onRemove: (item: FeedItem) => void;
}

const STATUS_ORDER: ListingStatus[] = ['available', 'reserved', 'unavailable'];

const EditListingSheet = ({ item, spots, saving, onClose, onSave, onRemove }: EditListingSheetProps) => {
  const [status, setStatus] = useState<ListingStatus>('available');
  const [spotIds, setSpotIds] = useState<string[]>([]);
  const [times, setTimes] = useState('');
  const [picking, setPicking] = useState(false);

  // Reset the draft whenever a different listing is opened.
  useEffect(() => {
    if (item) {
      setStatus(item.status);
      setSpotIds(item.spots.map(s => s.id));
      setTimes(item.availableTimes);
      setPicking(false);
    }
  }, [item]);

  if (!item) return null;

  const spotName = (id: string) => item.spots.find(s => s.id === id)?.name ?? spots.find(s => s.id === id)?.name ?? id;
  const addable = spots.filter(s => !spotIds.includes(s.id));
  const canAdd = spotIds.length < MAX_LISTING_SPOTS && addable.length > 0;

  /** Closing with unsaved edits asks first. */
  const requestClose = () => {
    const changed =
      status !== item.status ||
      times.trim() !== item.availableTimes ||
      spotIds.join(',') !== item.spots.map(s => s.id).join(',');
    if (!changed) {
      onClose();
      return;
    }
    dialog.alert('Discard your changes?', 'This listing has not been saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onClose },
    ]);
  };

  const handleSave = () => {
    const patch: ListingPatch = {};
    if (status !== item.status) patch.status = status;
    const before = item.spots.map(s => s.id).join(',');
    if (spotIds.join(',') !== before) {
      patch.spotIds = spotIds.filter(id => !isPin(id));
      patch.customSpots = item.spots
        .filter(s => s.custom && spotIds.includes(s.id))
        .map(({ name, lat, lng }) => ({ name, lat, lng }));
    }
    if (times.trim() !== item.availableTimes) patch.availableTimes = times.trim();
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    onSave(item, patch);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={requestClose} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={requestClose} accessibilityLabel="Close" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetWrap} pointerEvents="box-none">
        <View style={styles.sheet} testID="edit-listing-sheet">
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <Text style={styles.title}>Edit listing</Text>
            <TouchableOpacity accessibilityLabel="Close" onPress={requestClose} style={styles.close}>
              <X color={colors.purple} size={18} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.book}>
              <BookCover uri={item.book.thumbnail} width={44} height={64} radius={8} />
              <View style={styles.flex}>
                <Text style={styles.bookTitle} numberOfLines={2}>{item.book.title}</Text>
                <Text style={styles.bookAuthor} numberOfLines={1}>{item.book.author}</Text>
              </View>
            </View>

            <Text style={styles.section}>Availability</Text>
            <View style={styles.options}>
              {STATUS_ORDER.map(s => {
                const on = s === status;
                const palette = statusColors[s];
                return (
                  <TouchableOpacity
                    key={s}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    onPress={() => setStatus(s)}
                    activeOpacity={0.8}
                    style={[styles.option, on && { backgroundColor: palette.bg, borderColor: palette.dot, borderWidth: 2 }]}
                  >
                    <View style={[styles.radio, { borderColor: on ? palette.dot : colors.border }]}>
                      {on ? <View style={[styles.radioDot, { backgroundColor: palette.dot }]} /> : null}
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.optionTitle}>{STATUS_LABELS[s].title}</Text>
                      <Text style={styles.optionHint}>{STATUS_LABELS[s].hint}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.section}>Meetup locations</Text>
            <View style={styles.chips}>
              {spotIds.map(id => (
                <TouchableOpacity
                  key={id}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${spotName(id)}`}
                  disabled={spotIds.length === 1}
                  onPress={() => setSpotIds(prev => toggleInList(prev, id).list)}
                  style={styles.spotChip}
                >
                  <MapPin color={colors.accent} size={14} />
                  <Text style={styles.spotChipText} numberOfLines={1}>{spotName(id)}</Text>
                  {spotIds.length > 1 ? <X color={colors.accent} size={14} strokeWidth={2.4} /> : null}
                </TouchableOpacity>
              ))}
              {canAdd ? <Chip label="+ Add spot" selected={picking} onPress={() => setPicking(p => !p)} /> : null}
            </View>
            {spotIds.length === 1 ? <Text style={styles.hint}>A listing needs at least one meetup spot.</Text> : null}

            {picking && canAdd ? (
              <View style={styles.picker}>
                {addable.map(s => (
                  <TouchableOpacity
                    key={s.id}
                    style={styles.pickerRow}
                    onPress={() => {
                      setSpotIds(prev => toggleInList(prev, s.id, MAX_LISTING_SPOTS).list);
                      setPicking(false);
                    }}
                  >
                    <Text style={styles.pickerName}>{s.name}</Text>
                    <Text style={styles.pickerMeta}>{s.type}{s.city ? ` · ${s.city}` : ''}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            <Text style={styles.section}>Available times</Text>
            <TextInput
              style={styles.input}
              value={times}
              onChangeText={setTimes}
              placeholder="e.g. Weekends, after 3 PM"
              placeholderTextColor={colors.muted}
              maxLength={MAX_TIMES_LENGTH}
            />

            <AppButton label="Save changes" onPress={handleSave} loading={saving} style={styles.save} testID="save-listing" />
            <View style={styles.removeRow}>
              <AppButton small variant="danger" label="Remove listing" onPress={() => onRemove(item)} disabled={saving} />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrim: { ...StyleSheet.absoluteFill as object, backgroundColor: colors.scrim },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    maxHeight: '90%',
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '900', color: colors.heading },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' },
  book: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.field, borderRadius: 16, padding: 10 },
  bookTitle: { fontSize: 15, fontWeight: '800', color: colors.ink },
  bookAuthor: { fontSize: 12, color: colors.muted },
  section: { fontSize: 15, fontWeight: '800', color: colors.heading, marginTop: 16, marginBottom: 8 },
  options: { gap: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  optionTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  optionHint: { fontSize: 12, color: colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  spotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingLeft: 12,
    paddingRight: 10,
    borderRadius: 18,
    backgroundColor: colors.selected,
    borderWidth: 1.5,
    borderColor: colors.accent,
    maxWidth: '100%',
  },
  spotChipText: { fontSize: 13, fontWeight: '600', color: colors.accent, flexShrink: 1 },
  hint: { fontSize: 12, color: colors.muted, marginTop: 6 },
  picker: { marginTop: 8, borderRadius: 16, backgroundColor: colors.field, padding: 6 },
  pickerRow: { paddingVertical: 10, paddingHorizontal: 12 },
  pickerName: { fontSize: 14, fontWeight: '700', color: colors.ink },
  pickerMeta: { fontSize: 12, color: colors.muted, textTransform: 'capitalize' },
  input: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 16,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  save: { marginTop: 18 },
  removeRow: { alignItems: 'center', marginTop: 10 },
});

export default EditListingSheet;
