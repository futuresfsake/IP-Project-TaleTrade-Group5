// "List a book": pick a book from your library, set its condition, how it can change hands
// and where you can meet, then post it to the Feed.
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { dialog } from '../../component/ui/AppDialog';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePreventRemove } from '@react-navigation/native';
import { Check, ChevronLeft, MapPin } from 'lucide-react-native';
import { getAuth } from '@react-native-firebase/auth';
import { colors } from '../../theme/colors';
import { createListing, getMyLibrary, getSpots } from '../../services/feedService';
import { ApiError } from '../../services/apiClient';
import {
  CONDITIONS,
  CONDITION_LABELS,
  EXCHANGES,
  EXCHANGE_LABELS,
  MAX_LISTING_SPOTS,
  MAX_NOTE_LENGTH,
  MAX_TIMES_LENGTH,
  ListingForm,
  formToInput,
  toggleInList,
  validateListingForm,
} from '../../services/feedHelpers';
import { getPreferredSpots } from '../../services/map/meetupService';
import type { ApiSpot, LibraryBook } from '../../types';
import { AppButton, BookCover, Chip, EmptyState } from '../../component/feed/ui';

const CreateListingScreen = ({ navigation, route }: any) => {
  const insets = useSafeAreaInsets();

  const [library, setLibrary] = useState<LibraryBook[]>([]);
  const [spots, setSpots] = useState<ApiSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [posted, setPosted] = useState(false);
  // Spots shown as checkboxes: the user's preferred spots plus any picked on the list/map screen.
  const [offered, setOffered] = useState<string[]>([]);
  const [limitHit, setLimitHit] = useState(false);

  const [form, setForm] = useState<ListingForm>({
    bookId: route?.params?.bookId ?? null,
    condition: 'good',
    exchange: ['trade'],
    spotIds: [],
    pins: [],
    availableTimes: '',
    note: '',
  });
  const patch = (changes: Partial<ListingForm>) => setForm(prev => ({ ...prev, ...changes }));

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const uid = getAuth().currentUser?.uid;
      const [books, allSpots, preferred] = await Promise.all([
        getMyLibrary(),
        getSpots(),
        uid ? getPreferredSpots(uid) : Promise.resolve([] as string[]),
      ]);
      setLibrary(books);
      setSpots(allSpots);
      // Default to the meetup spots the user already chose in Settings.
      const known = new Set(allSpots.map(s => s.id));
      const defaults = preferred.filter(id => known.has(id)).slice(0, MAX_LISTING_SPOTS);
      setForm(prev => (prev.spotIds.length === 0 ? { ...prev, spotIds: defaults } : prev));
      setOffered(prev => Array.from(new Set([...prev, ...defaults])));
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Could not load your library.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Spots chosen on the "Meetup spots" screen come back through navigation params.
  useEffect(() => {
    const picked: string[] | undefined = route?.params?.spotIds;
    if (picked) {
      patch({ spotIds: picked, pins: route?.params?.pins ?? [] });
      setOffered(prev => Array.from(new Set([...prev, ...picked])));
      setLimitHit(false);
    }
  }, [route?.params?.spotIds, route?.params?.pins]);

  const problem = validateListingForm(form);

  // Leaving a half-filled form asks first.
  const dirty =
    !posted &&
    (form.bookId !== (route?.params?.bookId ?? null) ||
      !!form.note.trim() ||
      !!form.availableTimes.trim() ||
      (form.pins?.length ?? 0) > 0);
  usePreventRemove(dirty, ({ data }) => {
    dialog.alert('Discard this listing?', 'What you filled in will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });
  useEffect(() => {
    if (posted) navigation.goBack();
  }, [posted, navigation]);
  const listable = library.filter(b => !b.listing);

  const submit = async () => {
    setShowErrors(true);
    if (problem) return;
    setPosting(true);
    try {
      await createListing(formToInput(form));
      setPosted(true);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Could not post your listing.';
      dialog.alert('Could not post', message);
      if (e instanceof ApiError && e.code === 'listing_exists') load();
    } finally {
      setPosting(false);
    }
  };

  const spotName = (id: string) => spots.find(s => s.id === id);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <TouchableOpacity accessibilityLabel="Back" style={styles.back} onPress={() => navigation.goBack()}>
          <ChevronLeft color={colors.accent} size={22} />
        </TouchableOpacity>
        <View style={styles.flex}>
          <Text style={styles.title}>List a book</Text>
          <Text style={styles.subtitle}>Share it with readers nearby</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      ) : loadError ? (
        <EmptyState icon={<MapPin color={colors.purple} size={44} />} title="Couldn’t load your library" body={loadError}>
          <AppButton label="Try again" onPress={load} />
        </EmptyState>
      ) : library.length === 0 ? (
        <EmptyState
          icon={<MapPin color={colors.purple} size={44} />}
          title="Your library is empty"
          body="Add a book you own first, then you can list it here."
        >
          <AppButton label="Find books" onPress={() => navigation.navigate('Search')} />
        </EmptyState>
      ) : (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <SectionTitle title="Choose a book" hint="From your library" />
            {listable.length === 0 ? (
              <Text style={styles.hint}>All your books are already listed. Edit them from Feed → My listings.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.books}>
                {listable.map(b => {
                  const on = form.bookId === b.bookId;
                  return (
                    <TouchableOpacity
                      key={b.bookId}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      onPress={() => patch({ bookId: b.bookId })}
                      style={styles.pick}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.coverWrap, on && styles.coverOn]}>
                        <BookCover uri={b.thumbnail} width={84} height={124} radius={on ? 11 : 14} />
                        {on ? (
                          <View style={styles.check}>
                            <Check color={colors.white} size={14} strokeWidth={3} />
                          </View>
                        ) : null}
                      </View>
                      <Text style={[styles.pickTitle, on && styles.pickTitleOn]} numberOfLines={2}>{b.title}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <SectionTitle title="Condition" />
            <View style={styles.wrap}>
              {CONDITIONS.map(c => (
                <Chip key={c} label={CONDITION_LABELS[c]} selected={form.condition === c} onPress={() => patch({ condition: c })} />
              ))}
            </View>

            <SectionTitle title="How can others get it?" hint="Pick any" />
            <View style={styles.wrap}>
              {EXCHANGES.map(x => (
                <Chip
                  key={x}
                  label={EXCHANGE_LABELS[x]}
                  selected={form.exchange.includes(x)}
                  onPress={() => patch({ exchange: toggleInList(form.exchange, x).list })}
                />
              ))}
            </View>

            <SectionTitle title="Meetup spots" hint={`Up to ${MAX_LISTING_SPOTS}`} />
            {offered.map(id => {
              const s = spotName(id);
              const on = form.spotIds.includes(id);
              return (
                <TouchableOpacity
                  key={id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={s?.name ?? id}
                  activeOpacity={0.85}
                  onPress={() => {
                    const result = toggleInList(form.spotIds, id, MAX_LISTING_SPOTS - (form.pins?.length ?? 0));
                    patch({ spotIds: result.list });
                    setLimitHit(result.limitReached);
                  }}
                  style={[styles.spotRow, !on && styles.spotRowOff]}
                >
                  <MapPin color={on ? colors.accent : colors.muted} size={18} />
                  <View style={styles.flex}>
                    <Text style={styles.spotName}>{s?.name ?? id}</Text>
                    {s ? <Text style={styles.spotMeta}>{s.type}{s.city ? ` · ${s.city}` : ''}</Text> : null}
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
            })}
            {(form.pins ?? []).map((p, i) => (
              <TouchableOpacity
                key={`${p.lat}-${p.lng}`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: true }}
                accessibilityLabel={p.name}
                activeOpacity={0.85}
                onPress={() =>
                  dialog.alert('Remove this pin?', p.name, [
                    { text: 'Keep', style: 'cancel' },
                    {
                      text: 'Remove',
                      style: 'destructive',
                      onPress: () => patch({ pins: (form.pins ?? []).filter((_, j) => j !== i) }),
                    },
                  ])
                }
                style={styles.spotRow}
              >
                <MapPin color={colors.accent} size={18} />
                <View style={styles.flex}>
                  <Text style={styles.spotName}>{p.name}</Text>
                  <Text style={styles.spotMeta}>Pinned on the map</Text>
                </View>
                <View style={styles.checked}>
                  <Check color={colors.white} size={14} strokeWidth={3} />
                </View>
              </TouchableOpacity>
            ))}
            {limitHit ? <Text style={styles.limit}>You can pick up to {MAX_LISTING_SPOTS} spots. Uncheck one to choose another.</Text> : null}
            <AppButton
              small
              variant="ghost"
              label="+ Choose a spot or pin one on the map"
              style={styles.chooseSpots}
              onPress={() => navigation.navigate('ChooseSpots', { selected: form.spotIds, pins: form.pins, max: MAX_LISTING_SPOTS })}
            />

            <SectionTitle title="Available times" hint="Optional" />
            <TextInput
              style={styles.input}
              value={form.availableTimes}
              onChangeText={t => patch({ availableTimes: t })}
              placeholder="e.g. Weekends, after 3 PM"
              placeholderTextColor={colors.muted}
              maxLength={MAX_TIMES_LENGTH}
            />

            <SectionTitle title="Note" hint="Optional" />
            <TextInput
              style={[styles.input, styles.noteInput]}
              value={form.note}
              onChangeText={t => patch({ note: t })}
              placeholder="Anything readers should know?"
              placeholderTextColor={colors.muted}
              multiline
              maxLength={MAX_NOTE_LENGTH}
            />
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
            {showErrors && problem ? <Text style={styles.error}>{problem}</Text> : null}
            <AppButton label="Post to feed" onPress={submit} loading={posting} testID="post-listing" />
            <Text style={styles.footnote}>Visible to readers who share your meetup spots.</Text>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
};

const SectionTitle = ({ title, hint }: { title: string; hint?: string }) => (
  <View style={styles.sectionRow}>
    <Text style={styles.section}>{title}</Text>
    {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
  </View>
);

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
  loader: { marginTop: 60 },
  body: { paddingHorizontal: 20, paddingBottom: 24 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 10 },
  section: { fontSize: 16, fontWeight: '800', color: colors.heading },
  sectionHint: { fontSize: 12, fontWeight: '500', color: colors.muted },
  hint: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  books: { gap: 12 },
  pick: { width: 84, gap: 6 },
  coverWrap: { borderRadius: 14 },
  coverOn: { borderWidth: 3, borderColor: colors.accent, borderRadius: 14, overflow: 'hidden' },
  check: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickTitle: { fontSize: 12, fontWeight: '500', color: colors.body },
  pickTitleOn: { fontWeight: '700', color: colors.accent },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  spotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.selected,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  spotRowOff: { backgroundColor: colors.white, borderColor: colors.border },
  checked: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  unchecked: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.border },
  limit: { fontSize: 12, fontWeight: '600', color: colors.danger, marginBottom: 6 },
  spotName: { fontSize: 14, fontWeight: '700', color: colors.ink },
  spotMeta: { fontSize: 11, color: colors.muted, textTransform: 'capitalize' },
  chooseSpots: { alignSelf: 'flex-start', paddingHorizontal: 4 },
  input: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    fontSize: 15,
    color: colors.ink,
  },
  noteInput: { minHeight: 88, paddingTop: 14, textAlignVertical: 'top' },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    backgroundColor: colors.white,
    gap: 8,
    shadowColor: colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  error: { fontSize: 13, fontWeight: '600', color: colors.danger, textAlign: 'center' },
  footnote: { fontSize: 12, color: colors.muted, textAlign: 'center' },
});

export default CreateListingScreen;
