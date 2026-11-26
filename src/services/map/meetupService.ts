import {
  getFirestore,
  doc,
  collection,
  collectionGroup,
  query,
  where,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
  serverTimestamp,
} from '@react-native-firebase/firestore';
import type { MeetupSpot, SpotBook } from '../../types';

// Firestore allows at most 30 values in an array-contains-any filter.
const ARRAY_CONTAINS_ANY_LIMIT = 30;
// Stay well under the 500-operation batch limit.
const BATCH_CHUNK_SIZE = 400;

export const MAX_PREFERRED_SPOTS = 3;

/**
 * Toggles `spotId` in `selected`, enforcing `max`. When adding would exceed the
 * limit the selection is returned unchanged with `limitReached: true`.
 */
export const toggleSpotSelection = (
  selected: string[],
  spotId: string,
  max: number = MAX_PREFERRED_SPOTS,
): { spotIds: string[]; limitReached: boolean } => {
  if (selected.includes(spotId)) {
    return { spotIds: selected.filter(id => id !== spotId), limitReached: false };
  }
  if (selected.length >= max) {
    return { spotIds: selected, limitReached: true };
  }
  return { spotIds: [...selected, spotId], limitReached: false };
};

/**
 * Fields written to bookOwners/{bookId}/owners/{uid}. `book` is a myBooks doc
 * (or the output of extractBookFields); addedAt is added by the caller on create.
 */
export const buildOwnerFields = (
  userId: string,
  bookId: string,
  book: { title?: string; author?: string; thumbnail?: string | null },
  spotIds: string[],
) => ({
  userId,
  bookId,
  title: book.title || 'Untitled',
  author: book.author || 'Unknown Author',
  thumbnail: book.thumbnail ?? null,
  spotIds,
});

export const chunk = <T>(items: T[], size: number): T[][] => {
  if (size < 1) throw new Error('chunk size must be >= 1');
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
};

/**
 * Counts, for each of `spotIds`, how many rows list that spot in their `spotIds`.
 * Spots nobody picked are present with a count of 0.
 */
export const tallySpotCounts = (
  rows: Array<{ spotIds?: string[] }>,
  spotIds: string[],
): Record<string, number> => {
  const counts: Record<string, number> = {};
  spotIds.forEach(id => {
    counts[id] = 0;
  });
  rows.forEach(row => {
    (row.spotIds || []).forEach(id => {
      if (id in counts) counts[id] += 1;
    });
  });
  return counts;
};

/** Throws on failure so callers can show an error state. */
export type MapView =
  | { center: [number, number]; zoom: number }
  | { bounds: [number, number, number, number] };

const CEBU_CENTER: [number, number] = [123.8854, 10.3157];

/** Initial camera: Cebu City when empty, the spot when single, else a box around all spots. */
export const computeMapView = (spots: Array<{ lat: number; lng: number }>): MapView => {
  if (spots.length === 0) return { center: CEBU_CENTER, zoom: 11 };
  if (spots.length === 1) return { center: [spots[0].lng, spots[0].lat], zoom: 14 };
  const lngs = spots.map(s => s.lng);
  const lats = spots.map(s => s.lat);
  return { bounds: [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)] };
};

export const getActiveSpots = async (): Promise<MeetupSpot[]> => {
  try {
    const q = query(collection(getFirestore(), 'meetupSpots'), where('active', '==', true));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MeetupSpot));
  } catch (error) {
    console.error('Error fetching meetup spots:', error);
    throw error;
  }
};

export const getSpot = async (id: string): Promise<MeetupSpot | null> => {
  try {
    const snapshot = await getDoc(doc(getFirestore(), 'meetupSpots', id));
    return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as MeetupSpot) : null;
  } catch (error) {
    console.error('Error fetching meetup spot:', error);
    return null;
  }
};

/** Books offered at a spot (throws on failure), read from the denormalized fields on bookOwners/.../owners docs. */
export const getBooksAtSpot = async (spotId: string): Promise<SpotBook[]> => {
  try {
    const q = query(collectionGroup(getFirestore(), 'owners'), where('spotIds', 'array-contains', spotId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => {
      const data = d.data();
      return {
        bookId: data.bookId,
        title: data.title,
        author: data.author,
        thumbnail: data.thumbnail ?? null,
        ownerId: data.userId,
      };
    });
  } catch (error) {
    console.error('Error fetching books at spot:', error);
    throw error;
  }
};

type OwnerRow = { spotIds?: string[]; bookId?: string; userId?: string };

/**
 * For each spot, how many owner rows list it AND offer a book in `wishlistBookIds`,
 * ignoring rows owned by `excludeUserId` (your own copy shouldn't highlight a spot).
 */
export const tallyWishlistSpots = (
  rows: OwnerRow[],
  spotIds: string[],
  wishlistBookIds: string[],
  excludeUserId?: string,
): Record<string, number> => {
  const wanted = new Set(wishlistBookIds);
  const eligible = rows.filter(
    r => r.bookId && wanted.has(r.bookId) && (!excludeUserId || r.userId !== excludeUserId),
  );
  return tallySpotCounts(eligible, spotIds);
};

/**
 * Book availability per active spot, aggregated client-side (throws on failure):
 * `counts` = owner/book pairs at the spot, `wishlistCounts` = those matching the wishlist.
 */
export const getSpotAvailability = async (
  wishlistBookIds: string[] = [],
  excludeUserId?: string,
): Promise<{ counts: Record<string, number>; wishlistCounts: Record<string, number> }> => {
  const spotIds = (await getActiveSpots()).map(s => s.id);
  const counts = tallySpotCounts([], spotIds);
  const wishlistCounts = tallySpotCounts([], spotIds);
  try {
    const db = getFirestore();
    for (const ids of chunk(spotIds, ARRAY_CONTAINS_ANY_LIMIT)) {
      const q = query(collectionGroup(db, 'owners'), where('spotIds', 'array-contains-any', ids));
      const snapshot = await getDocs(q);
      const rows = snapshot.docs.map(d => d.data() as OwnerRow);
      Object.assign(counts, tallySpotCounts(rows, ids));
      Object.assign(wishlistCounts, tallyWishlistSpots(rows, ids, wishlistBookIds, excludeUserId));
    }
    return { counts, wishlistCounts };
  } catch (error) {
    console.error('Error fetching spot availability:', error);
    throw error;
  }
};

/** Number of available books per active spot id. */
export const getSpotBookCounts = async (): Promise<Record<string, number>> =>
  (await getSpotAvailability()).counts;

/** Ids of the books on the user's wishlist (empty on failure: highlighting is optional). */
export const getWishlistBookIds = async (uid: string): Promise<string[]> => {
  try {
    const snapshot = await getDocs(collection(getFirestore(), 'Users', uid, 'wishlist'));
    return snapshot.docs.map(d => d.id);
  } catch (error) {
    console.error('Error fetching wishlist ids:', error);
    return [];
  }
};

/** Union of the spot ids chosen by everyone who owns `bookId` (throws on failure). */
export const getSpotIdsForBook = async (bookId: string): Promise<string[]> => {
  try {
    const snapshot = await getDocs(collection(getFirestore(), 'bookOwners', bookId, 'owners'));
    return uniqueSpotIds(snapshot.docs.map(d => d.data() as OwnerRow));
  } catch (error) {
    console.error('Error fetching spots for book:', error);
    throw error;
  }
};

/**
 * The active spots offering a book, listed (Feed) spots first, then the other spots its
 * owners prefer. Unknown or inactive ids are skipped and nothing repeats.
 */
export const orderBookSpots = (
  activeSpots: MeetupSpot[],
  listingSpotIds: string[],
  ownerSpotIds: string[],
): MeetupSpot[] => {
  const byId = new Map(activeSpots.map(s => [s.id, s]));
  return Array.from(new Set([...listingSpotIds, ...ownerSpotIds]))
    .map(id => byId.get(id))
    .filter((s): s is MeetupSpot => !!s);
};

export const uniqueSpotIds = (rows: OwnerRow[]): string[] =>
  Array.from(new Set(rows.flatMap(r => r.spotIds || [])));

/** The signed-in user's preferred spot ids (empty on any failure). */
export const getPreferredSpots = async (uid: string): Promise<string[]> => {
  try {
    const snapshot = await getDoc(doc(getFirestore(), 'Users', uid));
    const spots = snapshot.exists() ? snapshot.data()?.preferredSpots : null;
    return Array.isArray(spots) ? spots : [];
  } catch (error) {
    console.error('Error fetching preferred spots:', error);
    return [];
  }
};

/**
 * Saves Users/{uid}.preferredSpots and rewrites spotIds (plus the denormalized
 * book fields) on every bookOwners/.../owners/{uid} doc built from the user's
 * myBooks. This also backfills owner docs created before these fields existed.
 */
export const setPreferredSpots = async (uid: string, spotIds: string[]): Promise<void> => {
  if (spotIds.length > MAX_PREFERRED_SPOTS) {
    throw new Error(`You can pick at most ${MAX_PREFERRED_SPOTS} meetup spots.`);
  }
  const unique = Array.from(new Set(spotIds));

  try {
    const db = getFirestore();

    await setDoc(
      doc(db, 'Users', uid),
      { preferredSpots: unique, lastUpdated: serverTimestamp() },
      { merge: true },
    );

    const myBooks = await getDocs(collection(db, 'Users', uid, 'myBooks'));
    for (const group of chunk(myBooks.docs, BATCH_CHUNK_SIZE)) {
      const batch = writeBatch(db);
      group.forEach(d => {
        // merge keeps the original addedAt on existing owner docs.
        batch.set(
          doc(db, 'bookOwners', d.id, 'owners', uid),
          buildOwnerFields(uid, d.id, d.data(), unique),
          { merge: true },
        );
      });
      await batch.commit();
    }
  } catch (error) {
    console.error('Error saving preferred spots:', error);
    throw error;
  }
};

export interface GroupedBook {
  bookId: string;
  title: string;
  author: string;
  thumbnail: string | null;
  ownerIds: string[];
  ownerCount: number;
  /** On the current user's wishlist and owned by someone other than them. */
  wishlisted: boolean;
}

/**
 * One entry per book at a spot, with its owners. Wishlist matches come first,
 * then books with more owners, then title A-Z.
 */
export const groupBooksByBookId = (
  rows: SpotBook[],
  wishlistBookIds: string[] = [],
  currentUserId?: string,
): GroupedBook[] => {
  const wanted = new Set(wishlistBookIds);
  const byBook = new Map<string, GroupedBook>();

  rows.forEach(row => {
    let entry = byBook.get(row.bookId);
    if (!entry) {
      entry = {
        bookId: row.bookId,
        title: row.title,
        author: row.author,
        thumbnail: row.thumbnail,
        ownerIds: [],
        ownerCount: 0,
        wishlisted: false,
      };
      byBook.set(row.bookId, entry);
    }
    if (!entry.ownerIds.includes(row.ownerId)) {
      entry.ownerIds.push(row.ownerId);
      entry.ownerCount = entry.ownerIds.length;
    }
  });

  const groups = Array.from(byBook.values());
  groups.forEach(g => {
    g.wishlisted = wanted.has(g.bookId) && g.ownerIds.some(id => id !== currentUserId);
  });

  return groups.sort(
    (a, b) =>
      Number(b.wishlisted) - Number(a.wishlisted) ||
      b.ownerCount - a.ownerCount ||
      a.title.localeCompare(b.title),
  );
};

/** Case-insensitive match on title or author; a blank query returns everything. */
export const filterBooks = (books: GroupedBook[], queryText: string): GroupedBook[] => {
  const q = queryText.trim().toLowerCase();
  if (!q) return books;
  return books.filter(b => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q));
};
