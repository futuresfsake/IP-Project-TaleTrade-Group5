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