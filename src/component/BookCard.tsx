import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BookCover } from './feed/ui';
import { colors, statusColors } from '../theme/colors';

interface BookCardProps {
  book: any;
  width?: number;
  /** Readers near you who offer this book. */
  nearby?: number;
}

const BookCard = ({ book, width = 120, nearby }: BookCardProps) => {
  // Access the navigation context
  const navigation = useNavigation<any>();

  // Extracting metadata safely to prevent crashes
  const imageUrl = book.volumeInfo?.imageLinks?.thumbnail;
  const title = book.volumeInfo?.title || "Unknown Title";
  const author = book.volumeInfo?.authors?.join(', ');

  const handlePress = () => {
    /**
     * MOBDEV LOGIC: 
     * If the card is in HomeScreen (nested in Tabs), we use getParent().
     * If the card is in GenreDetail (root stack), getParent() is null, so we use local navigation.
     *
     */
    const navigator = navigation.getParent() || navigation;

    navigator.navigate('BookDetail', { 
      bookId: book.id, 
      bookData: book // Passing full data for instant loading
    });
  };

  return (
    <TouchableOpacity style={[styles.card, { width }]} onPress={handlePress} activeOpacity={0.7}>
      <View style={styles.coverShadow}>
        <BookCover uri={imageUrl} width={width} height={Math.round(width * 1.47)} radius={14} />
        {nearby ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{nearby} nearby</Text>
          </View>
        ) : null}
      </View>
      <Text numberOfLines={2} style={styles.title}>{title}</Text>
      {author ? <Text numberOfLines={1} style={styles.author}>{author}</Text> : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: { marginBottom: 6, gap: 4 },
  badge: { position: 'absolute', left: 8, bottom: 8, backgroundColor: statusColors.available.bg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700', color: statusColors.available.text },
  coverShadow: { borderRadius: 14, backgroundColor: colors.cover, elevation: 4, marginBottom: 4 },
  title: { fontSize: 13, fontWeight: '700', color: colors.ink, lineHeight: 18 },
  author: { fontSize: 12, color: colors.muted },
});

export default BookCard;