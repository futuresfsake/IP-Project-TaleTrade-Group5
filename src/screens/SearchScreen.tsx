import React, { useRef, useState } from 'react';
import { View, TextInput, FlatList, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, Search as SearchIcon, X } from 'lucide-react-native';
import { BookCover, ScreenHeader } from '../component/feed/ui';
import { useNearby } from '../component/useNearby';
import { colors, shadow, statusColors } from '../theme/colors';
import { searchBooks } from '../services/bookService'; 

const NearbyPill = ({ count }: { count: number }) =>
  count > 0 ? (
    <Text style={styles.nearby}>
      {count} {count === 1 ? 'owner' : 'owners'} nearby
    </Text>
  ) : null;

const SearchScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const nearby = useNearby();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const latestRequest = useRef(0);

  const handleSearch = async (text: string) => {
    setQuery(text);
    const request = ++latestRequest.current;
    if (text.trim().length > 2) {
      setLoading(true);
      const books = await searchBooks(text);
      // A slower, older request must not overwrite the results for what is typed now.
      if (request !== latestRequest.current) return;
      setResults(books);
      setLoading(false);
    } else {
      setResults([]);
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Find Books" onBack={() => navigation.goBack()} />

      <View style={styles.inputWrapper}>
        <SearchIcon color={colors.muted} size={20} />
        <TextInput
          style={styles.input}
          placeholder="Search by title, author, or ISBN..."
          placeholderTextColor={colors.muted}
          value={query}
          autoFocus
          onChangeText={handleSearch}
        />
        {query ? (
          <TouchableOpacity accessibilityLabel="Clear search" onPress={() => handleSearch('')}>
            <X color={colors.muted} size={18} />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={results}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.hint}>
              {query.trim().length > 2 ? 'No books match your search.' : 'Type at least 3 characters to search.'}
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('BookDetail', { bookData: item })}
            >
              <BookCover uri={item.thumbnail} width={60} height={88} />
              <View style={styles.details}>
                <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.author} numberOfLines={1}>{item.authors.join(', ')}</Text>
                <NearbyPill count={nearby?.countFor({ id: item.id, title: item.title, author: item.authors.join(', ') }) ?? 0} />
              </View>
              <ChevronRight color={colors.muted} size={20} />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, marginHorizontal: 20, marginBottom: 10, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white },
  input: { flex: 1, fontSize: 15, color: colors.ink, padding: 0 },
  loader: { marginTop: 40 },
  list: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 40, gap: 12 },
  hint: { textAlign: 'center', color: colors.muted, marginTop: 40 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: 20, backgroundColor: colors.white, ...shadow },
  details: { flex: 1, gap: 4 },
  title: { fontSize: 16, fontWeight: '800', color: colors.ink },
  author: { fontSize: 13, color: colors.muted },
  nearby: { alignSelf: 'flex-start', fontSize: 12, fontWeight: '700', color: statusColors.available.text, backgroundColor: statusColors.available.bg, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3, overflow: 'hidden' },
});

export default SearchScreen;