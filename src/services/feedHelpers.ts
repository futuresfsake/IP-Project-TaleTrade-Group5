// Pure helpers for the Feed screens (kept free of React / Firebase so they are unit-testable).
import type { ExchangeType, FeedItem, ListingCondition, ListingInput, ListingStatus } from '../types';

export const CONDITIONS: ListingCondition[] = ['like_new', 'good', 'fair', 'well_loved'];
export const EXCHANGES: ExchangeType[] = ['trade', 'lend', 'give_away'];
export const MAX_LISTING_SPOTS = 3;
export const MAX_NOTE_LENGTH = 280;
export const MAX_TIMES_LENGTH = 80;

export const CONDITION_LABELS: Record<ListingCondition, string> = {
  like_new: 'Like new',
  good: 'Good',
  fair: 'Fair',
  well_loved: 'Well-loved',
};

export const EXCHANGE_LABELS: Record<ExchangeType, string> = {
  trade: 'Trade',
  lend: 'Lend',
  give_away: 'Give away',
};

export const STATUS_LABELS: Record<ListingStatus, { title: string; hint: string }> = {
  available: { title: 'Available', hint: 'Visible on the Feed and open to requests' },
  reserved: { title: 'Reserved', hint: 'Visible, but marked as taken for now' },
  unavailable: { title: 'Unavailable', hint: 'Hidden from the Feed until you turn it back on' },
};

export const initialsOf = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2);
  return letters.toUpperCase();
};

/** "just now", "5m ago", "3h ago", "Yesterday", "4d ago", then a short date. */
export const timeAgo = (timestamp: number, now: number = Date.now()): string => {
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

/** "Open to trade", "Open to trade or lend", "Open to trade, lend or give away". */
export const describeExchange = (exchange: ExchangeType[]): string => {
  const labels = exchange.map(e => EXCHANGE_LABELS[e].toLowerCase());
  if (labels.length === 0) return 'Ask the owner';
  if (labels.length === 1) return `Open to ${labels[0]}`;
  return `Open to ${labels.slice(0, -1).join(', ')} or ${labels[labels.length - 1]}`;
};

/** First spot name plus a "+N" for the rest, e.g. "Ayala Center Cebu +1". */
export const spotSummary = (spots: Array<{ name: string }>): string => {
  if (spots.length === 0) return 'No meetup spot';
  return spots.length === 1 ? spots[0].name : `${spots[0].name} +${spots.length - 1}`;
};

/** What a switch on a "My listings" card shows and where flipping it leads. */
export const availabilityToggle = (
  status: ListingStatus,
): { on: boolean; label: string; next: ListingStatus } => {
  if (status === 'available') return { on: true, label: 'Open to requests', next: 'unavailable' };
  if (status === 'reserved') return { on: false, label: 'Reserved', next: 'available' };
  return { on: false, label: 'Hidden from Feed', next: 'available' };
};

/** Toggles `value` in a list of at most `max` items (selection unchanged, `limitReached`, when full). */
export const toggleInList = <T>(
  list: T[],
  value: T,
  max: number = Infinity,
): { list: T[]; limitReached: boolean } => {
  if (list.includes(value)) return { list: list.filter(v => v !== value), limitReached: false };
  if (list.length >= max) return { list, limitReached: true };
  return { list: [...list, value], limitReached: false };
};

/** The flat bookData shape BookDetailScreen / addToWishlist already understand. */
export const toBookData = (book: FeedItem['book']) => ({
  id: book.id,
  title: book.title,
  authors: book.authors,
  description: '',
  thumbnail: book.thumbnail || undefined,
});

export interface ListingForm {
  bookId: string | null;
  condition: ListingCondition | null;
  exchange: ExchangeType[];
  spotIds: string[];
  availableTimes: string;
  note: string;
}

/** First problem with the form, or null when it can be posted. */
export const validateListingForm = (form: ListingForm): string | null => {
  if (!form.bookId) return 'Choose a book to list.';
  if (!form.condition) return 'Pick the book’s condition.';
  if (form.exchange.length === 0) return 'Choose how others can get it.';
  if (form.spotIds.length === 0) return 'Pick at least one meetup spot.';
  if (form.spotIds.length > MAX_LISTING_SPOTS) return `Pick at most ${MAX_LISTING_SPOTS} meetup spots.`;
  if (form.note.length > MAX_NOTE_LENGTH) return `Notes can be up to ${MAX_NOTE_LENGTH} characters.`;
  if (form.availableTimes.length > MAX_TIMES_LENGTH) return `Times can be up to ${MAX_TIMES_LENGTH} characters.`;
  return null;
};

export const formToInput = (form: ListingForm): ListingInput => ({
  bookId: form.bookId as string,
  condition: form.condition as ListingCondition,
  exchange: form.exchange,
  spotIds: form.spotIds,
  availableTimes: form.availableTimes.trim(),
  note: form.note.trim(),
});

/** Best next action text for an empty community feed, depending on the active filter. */
export const emptyFeedCopy = (filter: string): { title: string; body: string } => {
  if (filter === 'wishlist') {
    return {
      title: 'No wishlist matches yet',
      body: 'When someone lists a book from your wishlist, it will show up here.',
    };
  }
  if (filter === 'nearby') {
    return {
      title: 'Nothing nearby yet',
      body: 'No one has listed a book near you. Try a wider area or list one yourself.',
    };
  }
  return {
    title: 'Nothing shared nearby yet',
    body: 'Be the first to list a book at your meetup spots, or add more spots to see more readers.',
  };
};
