import { orderBookSpots, chunk, tallySpotCounts, toggleSpotSelection, buildOwnerFields, computeMapView, tallyWishlistSpots, uniqueSpotIds, groupBooksByBookId, filterBooks } from '../src/services/map/meetupService';

const { slugify, partitionSpots } = require('../scripts/seedMeetupSpots');

describe('chunk', () => {
  it('splits into groups of the given size', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it('returns [] for empty input', () => {
    expect(chunk([], 400)).toEqual([]);
  });
  it('rejects sizes below 1', () => {
    expect(() => chunk([1], 0)).toThrow();
  });
});

describe('tallySpotCounts', () => {
  it('counts per spot and includes zero-count spots', () => {
    const rows = [{ spotIds: ['a', 'b'] }, { spotIds: ['a'] }, {}];
    expect(tallySpotCounts(rows, ['a', 'b', 'c'])).toEqual({ a: 2, b: 1, c: 0 });
  });
  it('ignores spot ids that were not requested', () => {
    expect(tallySpotCounts([{ spotIds: ['x'] }], ['a'])).toEqual({ a: 0 });
  });
});

describe('orderBookSpots', () => {
  const spot = (id: string) => ({
    id, name: id, type: 'mall' as const, lat: 10, lng: 123, address: '', city: '', openHours: '', active: true,
  });

  it('puts listed spots first, without repeats or unknown ids', () => {
    const out = orderBookSpots([spot('a'), spot('b'), spot('c')], ['c', 'x'], ['a', 'c', 'a']);
    expect(out.map(s => s.id)).toEqual(['c', 'a']);
  });
  it('is empty when no spot offers the book', () => {
    expect(orderBookSpots([spot('a')], [], [])).toEqual([]);
  });
});

describe('seed script helpers', () => {
  it('derives ids from names', () => {
    expect(slugify('University of San Carlos – Talamban Campus Library')).toBe(
      'university-of-san-carlos-talamban-campus-library',
    );
    expect(slugify('SM City Cebu')).toBe('sm-city-cebu');
  });

  it('refuses entries with null coordinates and strips `verified`', () => {
    const { valid, refused } = partitionSpots([
      { name: 'No Coords', lat: null, lng: null },
      { name: 'Good Place', lat: 10.3, lng: 123.9, verified: true },
      { name: 'Out Of Range', lat: 100, lng: 0 },
    ]);
    expect(valid).toEqual([{ id: 'good-place', data: { name: 'Good Place', lat: 10.3, lng: 123.9 } }]);
    expect(refused.map((r: any) => r.spot.name)).toEqual(['No Coords', 'Out Of Range']);
  });
});

describe('toggleSpotSelection', () => {
  it('adds a spot below the limit', () => {
    expect(toggleSpotSelection(['a'], 'b')).toEqual({ spotIds: ['a', 'b'], limitReached: false });
  });
  it('removes an already selected spot', () => {
    expect(toggleSpotSelection(['a', 'b'], 'a')).toEqual({ spotIds: ['b'], limitReached: false });
  });
  it('refuses a 4th spot and flags the limit', () => {
    expect(toggleSpotSelection(['a', 'b', 'c'], 'd')).toEqual({ spotIds: ['a', 'b', 'c'], limitReached: true });
  });
  it('still allows deselecting at the limit', () => {
    expect(toggleSpotSelection(['a', 'b', 'c'], 'c').spotIds).toEqual(['a', 'b']);
  });
});

describe('buildOwnerFields', () => {
  it('builds the denormalized owner doc fields', () => {
    expect(buildOwnerFields('u1', 'b1', { title: 'T', author: 'A', thumbnail: 'x' }, ['s1'])).toEqual({
      userId: 'u1', bookId: 'b1', title: 'T', author: 'A', thumbnail: 'x', spotIds: ['s1'],
    });
  });
  it('applies defaults for missing book fields', () => {
    expect(buildOwnerFields('u1', 'b1', {}, [])).toEqual({
      userId: 'u1', bookId: 'b1', title: 'Untitled', author: 'Unknown Author', thumbnail: null, spotIds: [],
    });
  });
});

describe('computeMapView', () => {
  it('falls back to Cebu City when there are no spots', () => {
    expect(computeMapView([])).toEqual({ center: [123.8854, 10.3157], zoom: 11 });
  });
  it('centers on a single spot', () => {
    expect(computeMapView([{ lat: 10.3, lng: 123.9 }])).toEqual({ center: [123.9, 10.3], zoom: 14 });
  });
  it('bounds multiple spots as [west, south, east, north]', () => {
    expect(computeMapView([{ lat: 10.3, lng: 123.9 }, { lat: 10.35, lng: 123.91 }, { lat: 10.31, lng: 123.95 }])).toEqual({
      bounds: [123.9, 10.3, 123.95, 10.35],
    });
  });
});

describe('tallyWishlistSpots', () => {
  const rows = [
    { bookId: 'b1', userId: 'other', spotIds: ['a', 'b'] },
    { bookId: 'b2', userId: 'other', spotIds: ['a'] },
    { bookId: 'b1', userId: 'me', spotIds: ['b'] },
  ];
  it('counts only wishlisted books per spot', () => {
    expect(tallyWishlistSpots(rows, ['a', 'b'], ['b1'])).toEqual({ a: 1, b: 2 });
  });
  it("ignores the user's own copies", () => {
    expect(tallyWishlistSpots(rows, ['a', 'b'], ['b1'], 'me')).toEqual({ a: 1, b: 1 });
  });
  it('returns zeros for an empty wishlist', () => {
    expect(tallyWishlistSpots(rows, ['a', 'b'], [])).toEqual({ a: 0, b: 0 });
  });
});

describe('uniqueSpotIds', () => {
  it('unions spot ids across owners and tolerates missing lists', () => {
    expect(uniqueSpotIds([{ spotIds: ['a', 'b'] }, { spotIds: ['b', 'c'] }, {}])).toEqual(['a', 'b', 'c']);
  });
});

describe('groupBooksByBookId', () => {
  const row = (bookId: string, ownerId: string, title = bookId, author = 'A') => ({
    bookId, ownerId, title, author, thumbnail: null,
  });

  it('groups owners per book and counts distinct owners', () => {
    const groups = groupBooksByBookId([row('b1', 'u1'), row('b1', 'u2'), row('b1', 'u2'), row('b2', 'u1')]);
    const b1 = groups.find(g => g.bookId === 'b1')!;
    expect(b1.ownerIds).toEqual(['u1', 'u2']);
    expect(b1.ownerCount).toBe(2);
    expect(groups).toHaveLength(2);
  });

  it('sorts wishlist matches first, then more owners, then title', () => {
    const rows = [
      row('z', 'u1', 'Zebra'),
      row('a', 'u1', 'Apple'),
      row('m', 'u1', 'Mango'),
      row('m', 'u2', 'Mango'),
      row('w', 'u3', 'Wanted'),
    ];
    expect(groupBooksByBookId(rows, ['w']).map(g => g.bookId)).toEqual(['w', 'm', 'a', 'z']);
  });

  it("does not flag the user's own copy as a wishlist match", () => {
    const own = groupBooksByBookId([row('b1', 'me')], ['b1'], 'me');
    expect(own[0].wishlisted).toBe(false);
    const shared = groupBooksByBookId([row('b1', 'me'), row('b1', 'other')], ['b1'], 'me');
    expect(shared[0].wishlisted).toBe(true);
  });

  it('returns [] for no rows', () => {
    expect(groupBooksByBookId([])).toEqual([]);
  });
});

describe('filterBooks', () => {
  const books = groupBooksByBookId([
    { bookId: '1', ownerId: 'u', title: 'Dune', author: 'Frank Herbert', thumbnail: null },
    { bookId: '2', ownerId: 'u', title: 'Emma', author: 'Jane Austen', thumbnail: null },
  ]);
  it('matches title or author case-insensitively', () => {
    expect(filterBooks(books, 'dUnE').map(b => b.bookId)).toEqual(['1']);
    expect(filterBooks(books, 'austen').map(b => b.bookId)).toEqual(['2']);
  });
  it('returns all for a blank query and none for no match', () => {
    expect(filterBooks(books, '  ')).toHaveLength(2);
    expect(filterBooks(books, 'zzz')).toEqual([]);
  });
});

describe('location helpers', () => {
  const { haversineKm, formatDistance, sortByDistance } = require('../src/services/map/locationService');

  it('is 0 for identical points', () => {
    expect(haversineKm({ lat: 10.3, lng: 123.9 }, { lat: 10.3, lng: 123.9 })).toBe(0);
  });
  it('matches known distances', () => {
    // Paris -> London is about 343.5 km.
    expect(haversineKm({ lat: 48.8566, lng: 2.3522 }, { lat: 51.5074, lng: -0.1278 })).toBeCloseTo(343.5, 0);
    // One degree of latitude is about 111.19 km.
    expect(haversineKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111.19, 1);
  });
  it('is symmetric and handles the antimeridian', () => {
    const a = { lat: 10, lng: 179.5 };
    const b = { lat: 10, lng: -179.5 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 9);
    expect(haversineKm(a, b)).toBeLessThan(120);
  });
  it('formats distances', () => {
    expect(formatDistance(0.85)).toBe('850 m');
    expect(formatDistance(1.234)).toBe('1.2 km');
    expect(formatDistance(12)).toBe('12.0 km');
  });
  it('sorts nearest first without mutating the input', () => {
    const items = [{ n: 'far', d: 9 }, { n: 'near', d: 1 }, { n: 'mid', d: 4 }];
    expect(sortByDistance(items, (i: any) => i.d).map((i: any) => i.n)).toEqual(['near', 'mid', 'far']);
    expect(items[0].n).toBe('far');
  });
});
