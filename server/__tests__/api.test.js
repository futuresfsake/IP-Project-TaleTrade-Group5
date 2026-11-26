/* eslint-env jest, node */
const http = require('http');
const { createApp } = require('../src/app');
const { createMemoryStore } = require('../src/store/memoryStore');
const { normalizeVolume, createGoogleBooksProvider } = require('../src/bookProvider');
const { parseFeedQuery, validateCreateListing } = require('../src/validation');
const { haversineKm } = require('../src/geo');
const { createMapTilerProvider } = require('../src/placeProvider');

const SPOTS = [
  { id: 'ayala', name: 'Ayala Center Cebu', type: 'mall', city: 'Cebu City', address: 'Ayala, Cebu', lat: 10.3187, lng: 123.9053, openHours: '11:00 AM', active: true },
  { id: 'sm', name: 'SM City Cebu', type: 'mall', city: 'Cebu City', address: 'SM, Cebu', lat: 10.3115, lng: 123.9181, openHours: '10:00 AM', active: true },
  { id: 'far', name: 'Faraway Library', type: 'library', city: 'Manila', address: 'Manila', lat: 14.5995, lng: 120.9842, openHours: '9:00 AM', active: true },
  { id: 'closed', name: 'Closed Cafe', type: 'cafe', city: 'Cebu City', address: '-', lat: 10.3, lng: 123.9, openHours: '-', active: false },
];
const TOKENS = { 'tok-maria': { uid: 'maria' }, 'tok-juan': { uid: 'juan' } };
const verifyToken = async token => {
  if (!TOKENS[token]) throw new Error('bad token');
  return TOKENS[token];
};
const book = (bookId, title, author = 'Some Author') => ({ bookId, title, author, thumbnail: null });
const dune = { id: 'dune', title: 'Dune', authors: ['Frank Herbert'], description: 'Spice.', thumbnail: 'https://img/dune.jpg', isbn: '1', source: 'google-books' };

const servers = [];
afterEach(() => Promise.all(servers.splice(0).map(s => new Promise(resolve => s.close(resolve)))));

const setup = async ({ store: storeOpts = {}, provider, placeProvider, rateLimit } = {}) => {
  let t = 1000;
  const store = createMemoryStore({
    spots: SPOTS,
    users: { maria: { username: 'Maria', photoURL: 'http://x/m.png' }, juan: { username: 'Juan' } },
    myBooks: { maria: [book('dune', 'Dune', 'Frank Herbert'), book('hobbit', 'The Hobbit', 'J.R.R. Tolkien')], juan: [book('normal', 'Normal People', 'Sally Rooney')] },
    wishlists: { juan: ['dune'] },
    owners: { dune: 3 },
    ...storeOpts,
  });
  const bookProvider = provider || { getBook: async id => (id === 'dune' ? dune : null) };
  const app = createApp({ store, bookProvider, placeProvider, verifyToken, now: () => (t += 10), rateLimit });
  const server = await new Promise(resolve => {
    const s = app.listen(0, () => resolve(s));
  });
  servers.push(server);
  const { port } = server.address();

  const call = (method, path, { token = 'tok-juan', body, rawBody } = {}) =>
    new Promise((resolve, reject) => {
      const payload = rawBody !== undefined ? rawBody : body !== undefined ? JSON.stringify(body) : undefined;
      const req = http.request(
        { port, method, path, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(payload ? { 'content-type': 'application/json' } : {}) } },
        res => {
          let data = '';
          res.on('data', c => (data += c));
          res.on('end', () => resolve({ status: res.statusCode, json: data ? JSON.parse(data) : null, headers: res.headers }));
        },
      );
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  return { call, store };
};

const validListing = (over = {}) => ({ bookId: 'dune', condition: 'good', exchange: ['trade', 'lend'], spotIds: ['ayala'], availableTimes: 'Weekends', ...over });

describe('auth', () => {
  it('serves /health without a token', async () => {
    const { call } = await setup();
    expect((await call('GET', '/health', { token: null })).status).toBe(200);
  });
  it('rejects missing and invalid tokens', async () => {
    const { call } = await setup();
    expect((await call('GET', '/v1/feed', { token: null })).status).toBe(401);
    const bad = await call('GET', '/v1/feed', { token: 'nope' });
    expect(bad.status).toBe(401);
    expect(bad.json.error.code).toBe('unauthorized');
  });
  it('returns JSON 404 for unknown routes and 400 for malformed JSON', async () => {
    const { call } = await setup();
    expect((await call('GET', '/nope', { token: null })).json.error.code).toBe('not_found');
    const res = await call('POST', '/v1/listings', { token: 'tok-maria', rawBody: '{oops' });
    expect(res.status).toBe(400);
  });
  it('rate limits per caller', async () => {
    const { call } = await setup({ rateLimit: { limit: 2 } });
    await call('GET', '/v1/me/books');
    await call('GET', '/v1/me/books');
    const res = await call('GET', '/v1/me/books');
    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBeDefined();
  });
});

describe('listings', () => {
  it('creates a listing for a book in the owner library and returns a feed item', async () => {
    const { call } = await setup();
    const res = await call('POST', '/v1/listings', { token: 'tok-maria', body: validListing() });
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({
      id: 'maria_dune',
      status: 'available',
      condition: 'good',
      isMine: true,
      owner: { id: 'maria', username: 'Maria', photoURL: 'https://x/m.png' },
      book: { id: 'dune', title: 'Dune', authors: ['Frank Herbert'] },
    });
    expect(res.json.spots.map(s => s.id)).toEqual(['ayala']);
  });

  it('rejects books that are not in the caller library, duplicates and unknown spots', async () => {
    const { call } = await setup();
    expect((await call('POST', '/v1/listings', { token: 'tok-maria', body: validListing({ bookId: 'normal' }) })).json.error.code).toBe('book_not_in_library');
    expect((await call('POST', '/v1/listings', { token: 'tok-maria', body: validListing({ spotIds: ['closed'] }) })).status).toBe(400);
    await call('POST', '/v1/listings', { token: 'tok-maria', body: validListing() });
    const dup = await call('POST', '/v1/listings', { token: 'tok-maria', body: validListing() });
    expect(dup.status).toBe(409);
    expect(dup.json.error.code).toBe('listing_exists');
  });

  it('validates the body', async () => {
    const { call } = await setup();
    const cases = [
      { condition: 'mint' },
      { exchange: [] },
      { exchange: ['sell'] },
      { spotIds: [] },
      { spotIds: ['ayala', 'sm', 'far', 'closed'] },
      { note: 'x'.repeat(281) },
      { bookId: '../etc' },
    ];
    for (const over of cases) {
      const res = await call('POST', '/v1/listings', { token: 'tok-maria', body: validListing(over) });
      expect(res.status).toBe(400);
    }
  });

  it('lets only the owner update or delete, and delete is idempotent', async () => {
    const { call } = await setup();
    await call('POST', '/v1/listings', { token: 'tok-maria', body: validListing() });

    expect((await call('PATCH', '/v1/listings/maria_dune', { token: 'tok-juan', body: { status: 'reserved' } })).status).toBe(403);
    expect((await call('DELETE', '/v1/listings/maria_dune', { token: 'tok-juan' })).status).toBe(403);
    expect((await call('PATCH', '/v1/listings/maria_dune', { token: 'tok-maria', body: {} })).status).toBe(400);

    const patched = await call('PATCH', '/v1/listings/maria_dune', { token: 'tok-maria', body: { status: 'reserved', spotIds: ['sm'], note: '  after   3pm ' } });
    expect(patched.status).toBe(200);
    expect(patched.json).toMatchObject({ status: 'reserved', note: 'after 3pm' });
    expect(patched.json.spots.map(s => s.id)).toEqual(['sm']);

    expect((await call('DELETE', '/v1/listings/maria_dune', { token: 'tok-maria' })).status).toBe(204);
    expect((await call('DELETE', '/v1/listings/maria_dune', { token: 'tok-maria' })).status).toBe(204);
    expect((await call('DELETE', '/v1/listings/someone_else', { token: 'tok-maria' })).status).toBe(404);
  });
});

describe('feed', () => {
  const seed = async ctx => {
    await ctx.call('POST', '/v1/listings', { token: 'tok-maria', body: validListing() });
    await ctx.call('POST', '/v1/listings', { token: 'tok-maria', body: validListing({ bookId: 'hobbit', spotIds: ['far'], status: 'reserved' }) });
  };

  it('shows visible listings newest first, including your own (flagged isMine)', async () => {
    const ctx = await setup();
    await seed(ctx);
    const juan = await ctx.call('GET', '/v1/feed');
    expect(juan.json.items.map(i => i.book.id)).toEqual(['hobbit', 'dune']);
    expect(juan.json.items.find(i => i.book.id === 'dune').wishlisted).toBe(true);
    expect(juan.json.items.every(i => i.isMine === false)).toBe(true);
    const maria = await ctx.call('GET', '/v1/feed', { token: 'tok-maria' });
    expect(maria.json.items.map(i => [i.book.id, i.isMine])).toEqual([['hobbit', true], ['dune', true]]);
    expect((await ctx.call('GET', '/v1/feed?filter=wishlist', { token: 'tok-maria' })).json.items).toEqual([]);
  });

  it('hides unavailable listings from the community but keeps them in My listings', async () => {
    const ctx = await setup();
    await seed(ctx);
    await ctx.call('PATCH', '/v1/listings/maria_dune', { token: 'tok-maria', body: { status: 'unavailable' } });
    expect((await ctx.call('GET', '/v1/feed')).json.items.map(i => i.book.id)).toEqual(['hobbit']);
    const mine = await ctx.call('GET', '/v1/me/listings', { token: 'tok-maria' });
    expect(mine.json.items).toHaveLength(2);
    expect(mine.json.summary).toEqual({ listed: 2, available: 0, reserved: 1 });
  });

  it('supports available, wishlist and nearby filters', async () => {
    const ctx = await setup();
    await seed(ctx);
    expect((await ctx.call('GET', '/v1/feed?filter=available')).json.items.map(i => i.book.id)).toEqual(['dune']);
    expect((await ctx.call('GET', '/v1/feed?filter=wishlist')).json.items.map(i => i.book.id)).toEqual(['dune']);

    const nearby = await ctx.call('GET', '/v1/feed?filter=nearby&lat=10.3157&lng=123.8854&radiusKm=10');
    expect(nearby.json.items.map(i => i.book.id)).toEqual(['dune']);
    expect(nearby.json.items[0].nearestDistanceKm).toBeGreaterThan(0);

    expect((await ctx.call('GET', '/v1/feed?filter=nearby')).status).toBe(400);
    expect((await ctx.call('GET', '/v1/feed?filter=bogus')).status).toBe(400);
    expect((await ctx.call('GET', '/v1/feed?lat=10')).status).toBe(400);
  });

  it('paginates with a cursor without repeating items', async () => {
    const owners = ['u1', 'u2', 'u3', 'u4', 'u5'];
    const myBooks = Object.fromEntries(owners.map(u => [u, [book('b' + u, 'Book ' + u)]]));
    const listings = owners.map((u, i) => ({
      id: `${u}_b${u}`, ownerId: u, bookId: 'b' + u, title: 'Book ' + u, author: 'A', thumbnail: null,
      status: 'available', condition: 'good', exchange: ['trade'], spotIds: ['ayala'], availableTimes: '', note: '', createdAt: 100 + i, updatedAt: 100 + i,
    }));
    const { call } = await setup({ store: { myBooks, listings } });

    const seen = [];
    let cursor = null;
    for (let page = 0; page < 5; page += 1) {
      const res = await call('GET', `/v1/feed?limit=2${cursor ? `&cursor=${cursor}` : ''}`);
      seen.push(...res.json.items.map(i => i.book.id));
      cursor = res.json.nextCursor;
      if (!cursor) break;
    }
    expect(seen).toEqual(['bu5', 'bu4', 'bu3', 'bu2', 'bu1']);
  });

  it('drops listings whose book left the owner library and cleans them up', async () => {
    const ctx = await setup();
    await seed(ctx);
    ctx.store._removeMyBook('maria', 'dune');
    const res = await ctx.call('GET', '/v1/feed');
    expect(res.json.items.map(i => i.book.id)).toEqual(['hobbit']);
    await new Promise(resolve => setImmediate(resolve));
    expect(ctx.store._listings().map(l => l.id)).toEqual(['maria_hobbit']);
  });
});

describe('pinned locations', () => {
  const pin = { name: 'Corner cafe', lat: 10.3186, lng: 123.9052 };

  it('accepts a listing that only has a pinned location and returns it as a spot', async () => {
    const { call } = await setup();
    const res = await call('POST', '/v1/listings', { token: 'tok-maria', body: validListing({ spotIds: [], customSpots: [pin] }) });
    expect(res.status).toBe(201);
    expect(res.json.spots).toMatchObject([{ id: 'pin-1', name: 'Corner cafe', custom: true }]);
    const nearby = await call('GET', '/v1/feed?filter=nearby&lat=10.3187&lng=123.9053');
    expect(nearby.json.items.map(i => i.book.id)).toEqual(['dune']);
  });

  it('limits curated and pinned places together and validates pins', async () => {
    const { call } = await setup();
    const post = over => call('POST', '/v1/listings', { token: 'tok-maria', body: validListing(over) });
    expect((await post({ spotIds: [], customSpots: [] })).status).toBe(400);
    expect((await post({ spotIds: ['ayala', 'sm'], customSpots: [pin, pin] })).status).toBe(400);
    expect((await post({ spotIds: [], customSpots: [{ ...pin, lat: 200 }] })).status).toBe(400);
    expect((await post({ spotIds: [], customSpots: [{ ...pin, name: '  ' }] })).status).toBe(400);

    await post({ spotIds: ['ayala'] });
    const patch = body => call('PATCH', '/v1/listings/maria_dune', { token: 'tok-maria', body });
    expect((await patch({ spotIds: [] })).status).toBe(400);
    expect((await patch({ spotIds: [], customSpots: [pin] })).status).toBe(200);
  });
});

describe('place names', () => {
  const reply = features => ({ ok: true, json: async () => ({ features }) });

  it('prefers a point of interest under the pin, otherwise the street and area', async () => {
    const near = createMapTilerProvider({ apiKey: 'k', fetchImpl: async () => reply([{ text: 'Corner Cafe', center: [123.9, 10.3], place_type: ['poi'] }]) });
    expect(await near.reverse({ lat: 10.3, lng: 123.9 })).toMatchObject({ name: 'Corner Cafe' });

    const far = createMapTilerProvider({
      apiKey: 'k',
      fetchImpl: async url =>
        String(url).includes('types=poi')
          ? reply([{ text: 'Far Mall', center: [124.5, 10.9] }])
          : reply([{ text: 'Osmena Blvd', place_type: ['address'] }, { text: 'Capitol', place_type: ['place'] }]),
    });
    expect(await far.reverse({ lat: 10.3, lng: 123.9 })).toMatchObject({ name: 'Osmena Blvd, Capitol' });
  });

  it('serves names through the API and reports when they are unavailable', async () => {
    const placeProvider = { configured: true, reverse: async () => ({ name: 'Corner Cafe', address: null }) };
    const ok = await setup({ placeProvider });
    expect((await ok.call('GET', '/v1/places/reverse?lat=10.3&lng=123.9')).json.name).toBe('Corner Cafe');
    expect((await ok.call('GET', '/v1/places/reverse')).status).toBe(400);
    const off = await setup();
    expect((await off.call('GET', '/v1/places/reverse?lat=10.3&lng=123.9')).status).toBe(503);
  });
});

describe('reader listings', () => {
  it('returns only a reader visible listings', async () => {
    const { call } = await setup();
    await call('POST', '/v1/listings', { token: 'tok-maria', body: validListing() });
    await call('POST', '/v1/listings', { token: 'tok-maria', body: validListing({ bookId: 'hobbit', status: 'unavailable' }) });
    const res = await call('GET', '/v1/users/maria/listings');
    expect(res.json.items.map(i => [i.book.id, i.isMine])).toEqual([['dune', false]]);
    expect((await call('GET', '/v1/users/nobody/listings')).json.items).toEqual([]);
  });
});

describe('availability', () => {
  it('groups editions of a book and lists each owner with every place they can meet', async () => {
    const { call } = await setup({
      store: {
        users: { maria: { username: 'Maria', preferredSpots: ['sm'] }, juan: { username: 'Juan' } },
        myBooks: {
          maria: [book('dune', 'Dune', 'Frank Herbert')],
          juan: [book('dune-2', 'DUNE', 'Frank Herbert, Other'), { bookId: 'old' }],
        },
      },
    });
    await call('POST', '/v1/listings', { token: 'tok-maria', body: validListing({ spotIds: [], customSpots: [{ name: 'Cafe', lat: 10.3, lng: 123.9 }] }) });
    const { works } = (await call('GET', '/v1/availability')).json;

    const dune = works.find(w => w.bookIds.includes('dune'));
    expect(dune.bookIds.sort()).toEqual(['dune', 'dune-2']);
    expect(dune.owners.map(o => o.id).sort()).toEqual(['juan', 'maria']);
    const maria = dune.owners.find(o => o.id === 'maria');
    expect(maria.listing).toBe('available');
    expect(maria.spots.map(s => s.name)).toEqual(['SM City Cebu', 'Cafe']);
    expect(works.find(w => w.bookIds.includes('old')).owners).toHaveLength(1);
  });
});

describe('locations', () => {
  it('lists active spots with distance and listing counts, nearest first', async () => {
    const ctx = await setup();
    await ctx.call('POST', '/v1/listings', { token: 'tok-maria', body: validListing() });
    const res = await ctx.call('GET', '/v1/spots?lat=10.3187&lng=123.9053');
    const ids = res.json.items.map(s => s.id);
    expect(ids).toEqual(['ayala', 'sm', 'far']);
    expect(res.json.items[0]).toMatchObject({ distanceKm: 0, listingCount: 1 });
    expect(res.json.items.find(s => s.id === 'sm').listingCount).toBe(0);
    expect((await ctx.call('GET', '/v1/spots?type=library')).json.items.map(s => s.id)).toEqual(['far']);
    expect((await ctx.call('GET', '/v1/spots?type=moon')).status).toBe(400);
  });

  it('returns a spot with the listings available there', async () => {
    const ctx = await setup();
    await ctx.call('POST', '/v1/listings', { token: 'tok-maria', body: validListing() });
    const res = await ctx.call('GET', '/v1/spots/ayala');
    expect(res.json.spot.name).toBe('Ayala Center Cebu');
    expect(res.json.listings.map(l => l.book.id)).toEqual(['dune']);
    expect((await ctx.call('GET', '/v1/spots/closed')).status).toBe(404);
  });
});

describe('books', () => {
  it('returns normalised details plus community availability and locations', async () => {
    const ctx = await setup();
    await ctx.call('POST', '/v1/listings', { token: 'tok-maria', body: validListing({ spotIds: ['ayala', 'sm'] }) });
    const res = await ctx.call('GET', '/v1/books/dune?lat=10.3187&lng=123.9053', { token: 'tok-maria' });
    expect(res.status).toBe(200);
    expect(res.json.book).toMatchObject({ id: 'dune', title: 'Dune', source: 'google-books' });
    expect(res.json.community).toEqual({ ownerCount: 3, listingCount: 1, availableCount: 1 });
    expect(res.json.availableAt.map(s => s.id)).toEqual(['ayala', 'sm']);
    expect(res.json.myListing).toEqual({ id: 'maria_dune', status: 'available' });
  });

  it('falls back to our own data when the upstream provider fails', async () => {
    const provider = { getBook: async () => { throw new Error('boom'); } };
    const { call } = await setup({ provider });
    const res = await call('GET', '/v1/books/dune', { token: 'tok-maria' });
    expect(res.status).toBe(200);
    expect(res.json.book).toMatchObject({ title: 'Dune', authors: ['Frank Herbert'], source: 'taletrade' });
    const unknown = await call('GET', '/v1/books/ghost');
    expect(unknown.status).toBe(502);
  });

  it('returns 404 for books nobody knows and 400 for bad ids', async () => {
    const { call } = await setup();
    expect((await call('GET', '/v1/books/ghost')).json.error.code).toBe('book_not_found');
    expect((await call('GET', '/v1/books/a.b')).status).toBe(400);
  });

  it('lists the library flagging which books are already listed', async () => {
    const ctx = await setup();
    await ctx.call('POST', '/v1/listings', { token: 'tok-maria', body: validListing() });
    const res = await ctx.call('GET', '/v1/me/books', { token: 'tok-maria' });
    expect(res.json.items.map(b => [b.bookId, b.listing && b.listing.status])).toEqual([['dune', 'available'], ['hobbit', null]]);
  });
});

describe('helpers', () => {
  it('normalises a Google Books volume and forces https thumbnails', () => {
    const out = normalizeVolume({
      id: 'x1',
      volumeInfo: { title: 'T', authors: ['A'], description: '<p>Hello<br>world</p>', imageLinks: { thumbnail: 'http://img/t.jpg' }, industryIdentifiers: [{ type: 'ISBN_10', identifier: '111' }, { type: 'ISBN_13', identifier: '9780000000000' }] },
    });
    expect(out).toMatchObject({ id: 'x1', thumbnail: 'https://img/t.jpg', isbn: '9780000000000', description: 'Hello\nworld', source: 'google-books' });
  });

  it('caches provider responses and maps 404 to null', async () => {
    const fetchImpl = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ id: 'x', volumeInfo: { title: 'T' } }) }));
    const provider = createGoogleBooksProvider({ apiKey: 'k', fetchImpl });
    await provider.getBook('x');
    await provider.getBook('x');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0][0])).toContain('key=k');

    const missing = createGoogleBooksProvider({ fetchImpl: async () => ({ ok: false, status: 404 }) });
    expect(await missing.getBook('nope')).toBeNull();
  });

  it('computes distances and parses queries', () => {
    expect(haversineKm({ lat: 10.3187, lng: 123.9053 }, { lat: 10.3187, lng: 123.9053 })).toBe(0);
    expect(haversineKm({ lat: 10.3187, lng: 123.9053 }, { lat: 10.3115, lng: 123.9181 })).toBeGreaterThan(1);
    expect(parseFeedQuery({})).toMatchObject({ filter: 'all', limit: 20, radiusKm: 10, coords: null, cursor: null });
    expect(() => parseFeedQuery({ limit: '0' })).toThrow();
    expect(() => validateCreateListing(null)).toThrow();
  });
});
