// Who has which book, and which of them are near you. Search, Home, Genre, Wishlist and Book
// Detail all read this, so their owner lists and "N nearby" counts always agree.
//
// A meetup place is nearby when it is a spot you chose in Settings (or a pin right by one), or,
// only if location access was already granted, within NEARBY_RADIUS_KM of you.
import { getAuth } from '@react-native-firebase/auth';
import { getActiveSpots, getPreferredSpots } from './map/meetupService';
import { getUserLocationIfAllowed, haversineKm } from './map/locationService';
import type { Coords } from './map/locationService';
import { getAvailability } from './feedService';
import type { ApiSpot, BookOwner, BookWork } from '../types';

export const NEARBY_RADIUS_KM = 10;
// A pin this close to one of your spots counts as that spot.
const PIN_NEAR_SPOT_KM = 1;

export interface NearbyBook {
  bookId: string;
  title: string;
  author: string;
  thumbnail: string | null;
  /** Nearby readers, excluding you. */
  count: number;
}

/** How a book is identified wherever it comes from. */
export interface BookRef {
  id: string;
  title?: string | null;
  /** "Author" or "Author, Co-author". */
  author?: string | null;
}

/** Title + first author, so editions match. Mirrors workKey() in server/src/service.js. */
export const workKey = (title?: string | null, author?: string | null): string | null => {
  const clean = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  const name = clean(title || '');
  return name ? `${name}|${clean((author || '').split(',')[0])}` : null;
};

export const findWork = (works: BookWork[], book: BookRef): BookWork | undefined => {
  const key = workKey(book.title, book.author);
  return works.find(w => w.bookIds.includes(book.id)) ?? works.find(w => !!key && w.key === key);
};

export interface NearbyContext {
  preferred: ApiSpot[] | Array<{ id: string; lat: number; lng: number }>;
  coords: Coords | null;
}

export const isNearby = (place: { id: string; lat: number; lng: number }, { preferred, coords }: NearbyContext): boolean =>
  preferred.some(s => s.id === place.id || haversineKm(s, place) <= PIN_NEAR_SPOT_KM) ||
  (!!coords && haversineKm(coords, place) <= NEARBY_RADIUS_KM);

export const nearbyOwners = (owners: BookOwner[], context: NearbyContext, myUid?: string): BookOwner[] =>
  owners.filter(o => o.id !== myUid && o.spots.some(s => isNearby(s, context)));

export interface Nearby {
  works: BookWork[];
  /** Books with a nearby owner, most widely available first. */
  books: NearbyBook[];
  countFor: (book: BookRef) => number;
  isOwnerNearby: (owner: BookOwner) => boolean;
  /** False when nothing can count as nearby, so "none nearby" would be misleading. */
  hasSpots: boolean;
}

export const buildNearby = (works: BookWork[], context: NearbyContext, myUid?: string): Nearby => {
  const count = (work?: BookWork) => (work ? nearbyOwners(work.owners, context, myUid).length : 0);
  const books = works
    .filter(w => w.title)
    .map(w => ({
      bookId: w.bookIds[0],
      title: w.title as string,
      author: w.author || 'Unknown Author',
      thumbnail: w.thumbnail,
      count: count(w),
    }))
    .filter(b => b.count > 0)
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));

  return {
    works,
    books,
    countFor: book => count(findWork(works, book)),
    isOwnerNearby: owner => nearbyOwners([owner], context, myUid).length > 0,
    hasSpots: context.preferred.length > 0 || !!context.coords,
  };
};

export const getNearby = async (): Promise<Nearby> => {
  const uid = getAuth().currentUser?.uid;
  const [works, preferredIds, spots, coords] = await Promise.all([
    getAvailability(),
    uid ? getPreferredSpots(uid) : Promise.resolve([] as string[]),
    getActiveSpots(),
    getUserLocationIfAllowed(),
  ]);
  const preferred = spots.filter(s => preferredIds.includes(s.id));
  return buildNearby(works, { preferred, coords }, uid);
};
