import React, { useState, useEffect, useCallback } from 'react';
import { ScrollView, View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Search } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAuth } from '@react-native-firebase/auth';
import { getUserProfile } from '../services/userService';
import { useNearby } from '../component/useNearby';
import { Avatar } from '../component/feed/ui';
import { fetchBooksByGenre } from '../services/bookService';
import { getUserGenres } from '../services/genreService'; 
import BookCard from '../component/BookCard';
import { colors } from '../theme/colors';

const GENRES = ['Recommended', 'Contemporary', 'Memoir', 'Dystopian', 'Self-Help', 'Paranormal', 'Classics', 'Graphic Novel', 'Thriller & Suspense', 'Fantasy', 'Mystery', 'Historical Fiction'];

const HomeScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const nearby = useNearby();
  const [me, setMe] = useState<{ name: string; photo: string | null }>({ name: 'Reader', photo: null });

  // Refreshed on focus so a new name or photo from Settings shows up.
  useFocusEffect(
    useCallback(() => {
      const uid = getAuth().currentUser?.uid;
      if (!uid) return;
      getUserProfile(uid).then(profile => {
        if (profile) {
          setMe({ name: profile.username || 'Reader', photo: profile.photoURL?.replace('http://', 'https://') ?? null });
        }
      });
    }, []),
  );
  const [sections, setSections] = useState<{[key: string]: any[]}>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAllData = async () => {
      try {
        setLoading(true);
        const userPrefs = await getUserGenres();
        const recQuery = (userPrefs && userPrefs.length > 0) ? userPrefs[0] : 'fiction';
        const data: {[key: string]: any[]} = {};
        for (const genre of GENRES) {
          const query = genre === 'Recommended' ? recQuery : genre;
          data[genre] = await fetchBooksByGenre(query);
        }
        setSections(data);
      } catch (error) { console.error(error); } 
      finally { setLoading(false); }
    };
    loadAllData();
  }, []);

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <View style={styles.greetingRow}>
        <View style={styles.greetingText}>
          <Text style={styles.greeting} numberOfLines={1}>Good day, {me.name}</Text>
          <Text style={styles.tagline}>Find your next tale nearby</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open your profile" style={styles.profile} onPress={() => navigation.navigate('Profile')}>
          <Avatar name={me.name} uri={me.photo} size={44} />
        </TouchableOpacity>
      </View>
      {/* Looks like a text field but opens the Search screen, where typing happens. */}
      <TouchableOpacity
        style={styles.searchBar}
        activeOpacity={0.8}
        accessibilityRole="search"
        accessibilityLabel="Search books"
        onPress={() => navigation.navigate('Search')}
      >
        <Search color={colors.muted} size={20} />
        <Text style={styles.searchText} numberOfLines={1}>Search title, author or ISBN</Text>
      </TouchableOpacity>
    </View>
  );

  // The search bar is usable while the book rows are still loading.
  if (loading) return (
    <View style={styles.container}>
      {header}
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7E6FB0" />
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container} nestedScrollEnabled={true} showsVerticalScrollIndicator={false}>
      {header}

      {nearby && nearby.books.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.headerRow}>
            <Text style={styles.genreTitle}>Available near you</Text>
          </View>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={nearby.books.slice(0, 10)}
            keyExtractor={item => item.bookId}
            contentContainerStyle={styles.row}
            renderItem={({ item }) => (
              <BookCard
                nearby={item.count}
                book={{
                  id: item.bookId,
                  volumeInfo: { title: item.title, authors: [item.author], imageLinks: { thumbnail: item.thumbnail } },
                }}
              />
            )}
          />
        </View>
      ) : null}

      {GENRES.map((genre) => (
        <View key={genre} style={styles.section}>
          <View style={styles.headerRow}>
            <Text style={styles.genreTitle}>{genre === 'Recommended' ? 'Recommended for you' : genre}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('GenreDetail', { genreName: genre })}>
              <Text style={styles.viewAll}>View all</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={sections[genre] || []}
            renderItem={({ item }) => (
              <BookCard
                book={item}
                nearby={nearby?.countFor({ id: item.id, title: item.volumeInfo?.title, author: item.volumeInfo?.authors?.join(', ') })}
              />
            )}
            keyExtractor={(item, index) => `${genre}-${index}`}
            contentContainerStyle={styles.row}
          />
        </View>
      ))}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 20, marginBottom: 18, gap: 14 },
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  greetingText: { flex: 1 },
  greeting: { fontSize: 26, fontWeight: '900', color: colors.heading },
  tagline: { fontSize: 14, color: colors.muted },
  profile: { borderRadius: 24, backgroundColor: colors.white, padding: 2, elevation: 3 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, borderRadius: 16, paddingHorizontal: 16, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.border },
  searchText: { flex: 1, fontSize: 15, color: colors.muted },
  section: { marginBottom: 18 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  genreTitle: { fontSize: 20, fontWeight: '800', color: colors.heading },
  viewAll: { color: colors.accent, fontWeight: '700', fontSize: 14 },
  row: { paddingHorizontal: 20, gap: 14 },
});

export default HomeScreen;