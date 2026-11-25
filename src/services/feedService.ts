// Feed, listings, locations and enriched book details, all served by TaleTrade's own API.
import { apiRequest } from './apiClient';
import type {
  ApiSpot,
  BookDetails,
  FeedFilter,
  FeedPage,
  LibraryBook,
  ListingInput,
  ListingPatch,
  FeedItem,
  MeetupSpotType,
  MyListings,
} from '../types';
import type { Coords } from './map/locationService';

const coordQuery = (coords?: Coords | null) =>
  coords ? { lat: coords.lat, lng: coords.lng } : {};

export interface FeedParams {
  filter?: FeedFilter;
  coords?: Coords | null;
  radiusKm?: number;
  cursor?: number | null;
  limit?: number;
}

export const getFeed = ({ filter = 'all', coords, radiusKm, cursor, limit = 20 }: FeedParams = {}) =>
  apiRequest<FeedPage>('GET', '/v1/feed', {
    query: { filter, ...coordQuery(coords), radiusKm, cursor, limit },
  });

export const getMyListings = (coords?: Coords | null) =>
  apiRequest<MyListings>('GET', '/v1/me/listings', { query: coordQuery(coords) });

export const getMyLibrary = async (): Promise<LibraryBook[]> =>
  (await apiRequest<{ items: LibraryBook[] }>('GET', '/v1/me/books')).items;

export const createListing = (input: ListingInput) =>
  apiRequest<FeedItem>('POST', '/v1/listings', { body: input });

export const updateListing = (id: string, patch: ListingPatch) =>
  apiRequest<FeedItem>('PATCH', `/v1/listings/${encodeURIComponent(id)}`, { body: patch });

export const deleteListing = (id: string) =>
  apiRequest<void>('DELETE', `/v1/listings/${encodeURIComponent(id)}`);

/** The id the API gives a user's listing for a book, so it can be removed without a lookup. */
export const listingIdFor = (uid: string, bookId: string) => `${uid}_${bookId}`;

export const getSpots = async (opts: { coords?: Coords | null; type?: MeetupSpotType } = {}): Promise<ApiSpot[]> =>
  (await apiRequest<{ items: ApiSpot[] }>('GET', '/v1/spots', {
    query: { ...coordQuery(opts.coords), type: opts.type },
  })).items;

export const getBookDetails = (bookId: string, coords?: Coords | null) =>
  apiRequest<BookDetails>('GET', `/v1/books/${encodeURIComponent(bookId)}`, { query: coordQuery(coords) });
