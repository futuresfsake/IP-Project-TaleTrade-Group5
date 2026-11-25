import { getAuth } from '@react-native-firebase/auth';
import { ApiError, apiRequest, buildQuery, buildUrl } from '../src/services/apiClient';
import {
  availabilityToggle,
  describeExchange,
  emptyFeedCopy,
  formToInput,
  initialsOf,
  spotSummary,
  timeAgo,
  toBookData,
  toggleInList,
  validateListingForm,
} from '../src/services/feedHelpers';
import type { ListingForm } from '../src/services/feedHelpers';

const validForm: ListingForm = {
  bookId: 'dune',
  condition: 'good',
  exchange: ['trade'],
  spotIds: ['ayala'],
  availableTimes: '  Weekends ',
  note: '',
};

describe('feed helpers', () => {
  it('builds initials', () => {
    expect(initialsOf('Maria Santos')).toBe('MS');
    expect(initialsOf('juan')).toBe('JU');
    expect(initialsOf('  ')).toBe('?');
  });

  it('formats relative times', () => {
    const now = 1_000_000_000_000;
    expect(timeAgo(now - 5_000, now)).toBe('just now');
    expect(timeAgo(now - 5 * 60_000, now)).toBe('5m ago');
    expect(timeAgo(now - 3 * 3_600_000, now)).toBe('3h ago');
    expect(timeAgo(now - 30 * 3_600_000, now)).toBe('Yesterday');
    expect(timeAgo(now - 3 * 86_400_000, now)).toBe('3d ago');
  });

  it('describes exchange options and spots', () => {
    expect(describeExchange(['trade'])).toBe('Open to trade');
    expect(describeExchange(['trade', 'lend'])).toBe('Open to trade or lend');
    expect(describeExchange(['trade', 'lend', 'give_away'])).toBe('Open to trade, lend or give away');
    expect(spotSummary([])).toBe('No meetup spot');
    expect(spotSummary([{ name: 'Ayala' }])).toBe('Ayala');
    expect(spotSummary([{ name: 'Ayala' }, { name: 'SM' }])).toBe('Ayala +1');
  });

  it('maps listing status to the availability switch', () => {
    expect(availabilityToggle('available')).toMatchObject({ on: true, next: 'unavailable' });
    expect(availabilityToggle('reserved')).toMatchObject({ on: false, next: 'available' });
    expect(availabilityToggle('unavailable')).toMatchObject({ on: false, next: 'available' });
  });

  it('toggles list items within a limit', () => {
    expect(toggleInList(['a'], 'b', 2)).toEqual({ list: ['a', 'b'], limitReached: false });
    expect(toggleInList(['a', 'b'], 'c', 2)).toEqual({ list: ['a', 'b'], limitReached: true });
    expect(toggleInList(['a', 'b'], 'a', 2)).toEqual({ list: ['b'], limitReached: false });
  });

  it('validates the listing form and trims on submit', () => {
    expect(validateListingForm(validForm)).toBeNull();
    expect(validateListingForm({ ...validForm, bookId: null })).toMatch(/book/i);
    expect(validateListingForm({ ...validForm, condition: null })).toMatch(/condition/i);
    expect(validateListingForm({ ...validForm, exchange: [] })).toMatch(/how/i);
    expect(validateListingForm({ ...validForm, spotIds: [] })).toMatch(/spot/i);
    expect(validateListingForm({ ...validForm, spotIds: ['a', 'b', 'c', 'd'] })).toMatch(/at most/i);
    expect(formToInput(validForm).availableTimes).toBe('Weekends');
  });

  it('converts a feed book into the flat shape Book Detail and the wishlist expect', () => {
    expect(toBookData({ id: 'dune', title: 'Dune', author: 'Frank Herbert', authors: ['Frank Herbert'], thumbnail: null })).toEqual({
      id: 'dune',
      title: 'Dune',
      authors: ['Frank Herbert'],
      description: '',
      thumbnail: undefined,
    });
  });

  it('picks empty-state copy per filter', () => {
    expect(emptyFeedCopy('wishlist').title).toMatch(/wishlist/i);
    expect(emptyFeedCopy('nearby').title).toMatch(/nearby/i);
    expect(emptyFeedCopy('all').title).toMatch(/shared/i);
  });
});

describe('apiClient', () => {
  const fetchMock = jest.fn();
  const signedIn = () => (getAuth as jest.Mock).mockReturnValue({ currentUser: { uid: 'u1' } });

  beforeEach(() => {
    fetchMock.mockReset();
    (globalThis as any).fetch = fetchMock;
    signedIn();
  });

  it('builds query strings and urls', () => {
    expect(buildQuery({ a: 1, b: 'x y', c: undefined, d: null, e: '' })).toBe('?a=1&b=x%20y');
    expect(buildQuery()).toBe('');
    expect(buildUrl('http://h:3000/', '/v1/feed', { limit: 5 })).toBe('http://h:3000/v1/feed?limit=5');
  });

  it('sends the bearer token and parses JSON', async () => {
    fetchMock.mockResolvedValue({ status: 200, ok: true, json: async () => ({ items: [] }) });
    const out = await apiRequest('GET', '/v1/feed', { query: { limit: 2 } });
    expect(out).toEqual({ items: [] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/v1/feed?limit=2');
    expect(init.headers.Authorization).toBe('Bearer test-token');
  });

  it('serialises bodies and handles 204', async () => {
    fetchMock.mockResolvedValue({ status: 204, ok: true });
    await expect(apiRequest('DELETE', '/v1/listings/x')).resolves.toBeUndefined();
    fetchMock.mockResolvedValue({ status: 201, ok: true, json: async () => ({ id: 'a' }) });
    await apiRequest('POST', '/v1/listings', { body: { bookId: 'b' } });
    expect(fetchMock.mock.calls[1][1].body).toBe('{"bookId":"b"}');
    expect(fetchMock.mock.calls[1][1].headers['Content-Type']).toBe('application/json');
  });

  it('turns API errors into ApiError with the server code and message', async () => {
    fetchMock.mockResolvedValue({
      status: 409,
      ok: false,
      json: async () => ({ error: { code: 'listing_exists', message: 'Already listed.' } }),
    });
    await expect(apiRequest('POST', '/v1/listings', { body: {} })).rejects.toMatchObject({
      status: 409,
      code: 'listing_exists',
      message: 'Already listed.',
    });
  });

  it('reports network failures and missing sign-in', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    await expect(apiRequest('GET', '/v1/feed')).rejects.toMatchObject({ code: 'network' });
    (getAuth as jest.Mock).mockReturnValue({ currentUser: null });
    await expect(apiRequest('GET', '/v1/feed')).rejects.toBeInstanceOf(ApiError);
  });
});
