// Feed, listings, locations and enriched book details, all served by TaleTrade's own API.
import { apiRequest } from './apiClient';
import type {
  ApiSpot,
  BookDetails,
  BookWork,
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

/** Removes all of the signed-in user's listings, hidden ones included. */
export const deleteMyListings = () => apiRequest<void>('DELETE', '/v1/me/listings');

/** The id the API gives a user's listing for a book, so it can be removed without a lookup. */
export const listingIdFor = (uid: string, bookId: string) => `${uid}_${bookId}`;

export const getSpots = async (opts: { coords?: Coords | null; type?: MeetupSpotType } = {}): Promise<ApiSpot[]> =>
  (await apiRequest<{ items: ApiSpot[] }>('GET', '/v1/spots', {
    query: { ...coordQuery(opts.coords), type: opts.type },
  })).items;

/** Visible Feed listings that can be picked up at one meetup spot. */
export const getSpotListings = async (spotId: string): Promise<FeedItem[]> =>
  (await apiRequest<{ listings: FeedItem[] }>('GET', `/v1/spots/${encodeURIComponent(spotId)}`)).listings;

/** Name of the place at a coordinate, from TaleTrade's API. */
export const getPlaceName = async (lat: number, lng: number): Promise<string> =>
  (await apiRequest<{ name: string }>('GET', '/v1/places/reverse', { query: { lat, lng } })).name;

/** A reader's visible listings. */
export const getUserListings = async (userId: string): Promise<FeedItem[]> =>
  (await apiRequest<{ items: FeedItem[] }>('GET', `/v1/users/${encodeURIComponent(userId)}/listings`)).items;

/** Everyone's books and where they can meet: the one source for owner lists and badges. */
export const getAvailability = async (): Promise<BookWork[]> =>
  (await apiRequest<{ works: BookWork[] }>('GET', '/v1/availability')).works;

export const getBookDetails = (bookId: string, coords?: Coords | null) =>
  apiRequest<BookDetails>('GET', `/v1/books/${encodeURIComponent(bookId)}`, { query: coordQuery(coords) });
