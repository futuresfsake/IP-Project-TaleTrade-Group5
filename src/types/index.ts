export interface Book {
  id: string;
  title: string;
  authors: string[];
  publisher: string;
  description: string;
  thumbnail?: string;
  isbn?: string;
}

export type MeetupSpotType = 'mall' | 'library' | 'bookstore' | 'cafe' | 'campus' | 'other';

export interface MeetupSpot {
  id: string;
  name: string;
  type: MeetupSpotType;
  lat: number;
  lng: number;
  address: string;
  city: string;
  openHours: string;
  safetyNote?: string;
  active: boolean;
}

/** A book offered at a meetup spot (denormalized from bookOwners/{bookId}/owners/{uid}). */
export interface SpotBook {
  bookId: string;
  title: string;
  author: string;
  thumbnail: string | null;
  ownerId: string;
}

// ---------------------------------------------------------------------------
// TaleTrade API (server/): Feed, listings and enriched book / location details
// ---------------------------------------------------------------------------

export type ListingStatus = 'available' | 'reserved' | 'unavailable';
export type ListingCondition = 'like_new' | 'good' | 'fair' | 'well_loved';
export type ExchangeType = 'trade' | 'lend' | 'give_away';
export type FeedFilter = 'all' | 'available' | 'nearby' | 'wishlist';

/** A meetup location as served by the API (distance is present when coordinates were sent). */
export interface ApiSpot {
  id: string;
  name: string;
  type: MeetupSpotType;
  city: string | null;
  address: string | null;
  lat: number;
  lng: number;
  openHours: string | null;
  safetyNote: string | null;
  distanceKm?: number;
  listingCount?: number;
  /** True for a location the owner pinned on the map (not a curated spot). */
  custom?: boolean;
}

/** A location pinned on the map. */
export interface PinnedPlace {
  name: string;
  lat: number;
  lng: number;
}

export interface FeedItem {
  id: string;
  status: ListingStatus;
  condition: ListingCondition;
  exchange: ExchangeType[];
  availableTimes: string;
  note: string;
  createdAt: number;
  updatedAt: number;
  isMine: boolean;
  wishlisted: boolean;
  owner: { id: string; username: string; photoURL: string | null };
  book: { id: string; title: string; author: string; authors: string[]; thumbnail: string | null };
  spots: ApiSpot[];
  nearestDistanceKm: number | null;
}

export interface FeedPage {
  items: FeedItem[];
  nextCursor: number | null;
}

export interface ListingSummary {
  listed: number;
  available: number;
  reserved: number;
}

export interface MyListings {
  items: FeedItem[];
  summary: ListingSummary;
}

/** A book in the user's library, flagged with its listing when it is already on the Feed. */
export interface LibraryBook {
  bookId: string;
  title: string;
  author: string;
  thumbnail: string | null;
  listing: { id: string; status: ListingStatus } | null;
}

export interface ListingInput {
  bookId: string;
  condition: ListingCondition;
  exchange: ExchangeType[];
  spotIds: string[];
  customSpots?: PinnedPlace[];
  availableTimes?: string;
  note?: string;
  status?: ListingStatus;
}

export type ListingPatch = Partial<Omit<ListingInput, 'bookId'>>;

export interface BookOwner {
  id: string;
  username: string;
  photoURL: string | null;
  /** Their visible Feed listing for this book, if any. */
  listing: ListingStatus | null;
  /** Where they can meet: preferred spots, listing spots and pinned places. */
  spots: ApiSpot[];
}

/** One book (all editions) with everyone who has it. */
export interface BookWork {
  key: string;
  bookIds: string[];
  title: string | null;
  author: string | null;
  thumbnail: string | null;
  owners: BookOwner[];
}

export interface BookDetails {
  book: {
    id: string;
    title: string;
    authors: string[];
    publisher: string | null;
    description: string;
    thumbnail: string | null;
    isbn: string | null;
    publishedDate: string | null;
    pageCount: number | null;
    categories: string[];
    language: string | null;
    source: 'google-books' | 'taletrade';
  };
  community: { ownerCount: number; listingCount: number; availableCount: number };
  availableAt: ApiSpot[];
  myListing: { id: string; status: ListingStatus } | null;
}
