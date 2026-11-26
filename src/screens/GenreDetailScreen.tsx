import React, { useEffect, useState } from 'react';
import { FlatList, View, Text, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '../component/feed/ui';
import { useNearby } from '../component/useNearby';
import { colors } from '../theme/colors';
import { fetchBooksByGenre } from '../services/bookService';
import { getUserGenres } from '../services/genreService'; 
import BookCard from '../component/BookCard';

const { width } = Dimensions.get('window');
// Three columns inside 20pt side padding with 14pt gaps.
const CARD_WIDTH = Math.floor((width - 40 - 28) / 3);

const GenreDetailScreen = ({ route, navigation }: any) => {
  const insets = useSafeAreaInsets();
  const nearby = useNearby();
  const { genreName } = route.params; 
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        let query = genreName;

        // FIX: If the genre is "Recommended", find the user's preferred genre to search for
        if (genreName === 'Recommended') {
          const userPrefs = await getUserGenres();
          query = (userPrefs && userPrefs.length > 0) ? userPrefs[0] : 'fiction';
        }

        const results = await fetchBooksByGenre(query, 40);
        setBooks(results || []);
      } catch (error) {
        console.error("Error fetching genre detail:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [genreName]);

  const header = (
    <ScreenHeader title={genreName || 'Explore'} onBack={() => navigation.goBack()} />
  );

  if (loading) return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {header}
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {header}
      <FlatList
        data={books}
        numColumns={3}
        keyExtractor={(item, index) => `${index}`}
        renderItem={({ item }) => (
          <BookCard
            book={item}
            width={CARD_WIDTH}
            nearby={nearby?.countFor({ id: item.id, title: item.volumeInfo?.title, author: item.volumeInfo?.authors?.join(', ') })}
          />
        )}
        contentContainerStyle={styles.list}
        columnWrapperStyle={styles.columnWrapper}
        ListEmptyComponent={<Text style={styles.empty}>No books found.</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  columnWrapper: { justifyContent: 'space-between', marginBottom: 12 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 40 },
});

export default GenreDetailScreen;