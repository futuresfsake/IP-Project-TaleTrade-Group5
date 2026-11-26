/* eslint-env node */
/**
 * TaleTrade's business logic, independent of Express and Firestore: both the data layer
 * (`store`) and the book metadata source (`bookProvider`) are injected.
 */
const { ApiError, forbidden, notFound, conflict, badRequest } = require('./errors');
const { haversineKm } = require('./geo');
const { validateCreateListing, validateUpdateListing, assertPlaceCount, bookIdOf } = require('./validation');

const VISIBLE_STATUSES = ['available', 'reserved'];
const SPOT_CACHE_MS = 60000;
const round2 = n => Math.round(n * 100) / 100;

const listingId = (uid, bookId) => `${uid}_${bookId}`;
const splitAuthors = author =>
  typeof author === 'string' && author.trim() ? author.split(/,\s*/) : ['Unknown Author'];
const httpsUrl = url => (typeof url === 'string' && url ? url.replace(/^http:/, 'https:') : null);

const toSpotDto = (spot, coords) => {
  const dto = {
    id: spot.id,
    name: spot.name,
    type: spot.type,
    city: spot.city || null,
    address: spot.address || null,
    lat: spot.lat,
    lng: spot.lng,
    openHours: spot.openHours || null,
    safetyNote: spot.safetyNote || null,
  };
  if (coords && Number.isFinite(spot.lat) && Number.isFinite(spot.lng)) {
    dto.distanceKm = round2(haversineKm(coords, { lat: spot.lat, lng: spot.lng }));
  }
  return dto;
};

/** A listing's pinned locations, shaped like spots so clients can treat them alike. */
const pinsToSpots = (listing, coords) =>
  (listing.customSpots || []).map((pin, i) => ({
    ...toSpotDto({ ...pin, id: `pin-${i + 1}`, type: 'other' }, coords),
    custom: true,
  }));

/**
 * Identifies a book across editions: Google Books gives every edition its own id, so owners
 * are matched on title + first author. Must stay in step with the app's workKey().
 */
const workKey = (title, author) => {
  const clean = s =>
    String(s || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  const name = clean(title);
  return name ? `${name}|${clean(String(author || '').split(',')[0])}` : null;
};

const createService = ({ store, bookProvider, now = Date.now }) => {
  let spotCache = { at: 0, data: null };

  /** Active meetup spots, cached briefly because they change rarely (curated, seeded). */
  const getSpots = async () => {
    if (spotCache.data && now() - spotCache.at < SPOT_CACHE_MS) return spotCache.data;
    const data = await store.getSpots();
    spotCache = { at: now(), data };
    return data;
  };

  const assertSpots = async spotIds => {
    const known = new Set((await getSpots()).map(s => s.id));
    const unknown = spotIds.filter(id => !known.has(id));
    if (unknown.length > 0) throw badRequest(`Unknown or inactive meetup spot: ${unknown.join(', ')}.`);
  };

  /** Listings whose book is no longer in the owner's library are dropped (and cleaned up in the background). */
  const withoutOrphans = async listings => {
    const existing = await store.filterExistingMyBooks(listings.map(l => [l.ownerId, l.bookId]));
    const alive = [];
    const orphanIds = [];
    listings.forEach(l => {
      if (existing.has(`${l.ownerId}/${l.bookId}`)) alive.push(l);
      else orphanIds.push(l.id);
    });
    if (orphanIds.length > 0) store.deleteListings(orphanIds).catch(() => {});
    return alive;
  };

  const toFeedItems = async (listings, { uid, coords, wishlist = new Set() }) => {
    const [spots, owners] = await Promise.all([getSpots(), store.getUsers(listings.map(l => l.ownerId))]);
    const spotsById = new Map(spots.map(s => [s.id, s]));

    return listings.map(l => {
      const owner = owners[l.ownerId] || {};
      const itemSpots = [
        ...l.spotIds.map(id => spotsById.get(id)).filter(Boolean).map(s => toSpotDto(s, coords)),
        ...pinsToSpots(l, coords),
      ];
      const distances = itemSpots.map(s => s.distanceKm).filter(d => d !== undefined);
      return {
        id: l.id,
        status: l.status,
        condition: l.condition,
        exchange: l.exchange,
        availableTimes: l.availableTimes || '',
        note: l.note || '',
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
        isMine: l.ownerId === uid,
        wishlisted: wishlist.has(l.bookId) && l.ownerId !== uid,
        owner: {
          id: l.ownerId,
          username: owner.username || owner.displayName || 'Reader',
          photoURL: httpsUrl(owner.photoURL),
        },
        book: {
          id: l.bookId,
          title: l.title,
          author: l.author,
          authors: splitAuthors(l.author),
          thumbnail: httpsUrl(l.thumbnail),
        },
        spots: itemSpots,
        nearestDistanceKm: distances.length > 0 ? Math.min(...distances) : null,
      };
    });
  };

  return {
    // ---------------------------------------------------------------- availability
    /**
     * Every owned book with its owners and where each can meet: their preferred spots plus the
     * spots and pins of their visible listings. Editions of one book are grouped together.
     */
    async availability() {
      const [rows, listings, spots] = await Promise.all([
        store.listOwnedBooks(),
        store.listAllListings(),
        getSpots(),
      ]);
      const owners = await store.getUsers(rows.map(r => r.ownerId));
      const spotsById = new Map(spots.map(s => [s.id, s]));

      // An old record without a title still joins its book through the shared id.
      const keyById = new Map();
      rows.forEach(r => {
        const key = workKey(r.title, r.author);
        if (key && !keyById.has(r.bookId)) keyById.set(r.bookId, key);
      });

      const works = new Map();
      rows.forEach(r => {
        const key = keyById.get(r.bookId) || `id:${r.bookId}`;
        let work = works.get(key);
        if (!work) {
          work = { key, bookIds: new Set(), title: null, author: null, thumbnail: null, owners: new Map() };
          works.set(key, work);
        }
        work.bookIds.add(r.bookId);
        work.title = work.title || r.title || null;
        work.author = work.author || r.author || null;
        work.thumbnail = work.thumbnail || httpsUrl(r.thumbnail);
        if (!work.owners.has(r.ownerId)) work.owners.set(r.ownerId, { listings: [] });
        const listing = listings.find(l => l.ownerId === r.ownerId && l.bookId === r.bookId);
        if (listing && VISIBLE_STATUSES.includes(listing.status)) work.owners.get(r.ownerId).listings.push(listing);
      });

      const ownerDto = (id, entry) => {
        const user = owners[id] || {};
        const places = new Map();
        const spotIds = [
          ...(Array.isArray(user.preferredSpots) ? user.preferredSpots : []),
          ...entry.listings.flatMap(l => l.spotIds),
        ];
        spotIds.forEach(spotId => {
          const spot = spotsById.get(spotId);
          if (spot) places.set(spotId, toSpotDto(spot));
        });
        entry.listings.flatMap(l => pinsToSpots(l)).forEach(pin => {
          const placeId = `pin-${pin.lat},${pin.lng}`;
          places.set(placeId, { ...pin, id: placeId });
        });
        const statuses = entry.listings.map(l => l.status);
        return {
          id,
          username: user.username || user.displayName || 'Reader',
          photoURL: httpsUrl(user.photoURL),
          listing: statuses.includes('available') ? 'available' : statuses[0] || null,
          spots: Array.from(places.values()),
        };
      };

      return {
        works: Array.from(works.values()).map(w => ({
          key: w.key,
          bookIds: Array.from(w.bookIds),
          title: w.title,
          author: w.author,
          thumbnail: w.thumbnail,
          owners: Array.from(w.owners, ([id, entry]) => ownerDto(id, entry)),
        })),
      };
    },

    // ------------------------------------------------------------------ locations
    async listSpots({ coords, type }) {
      const spots = (await getSpots()).filter(s => !type || s.type === type);
      const counts = await Promise.all(
        spots.map(async s => {
          const rows = await store.listListingsBySpot(s.id);
          return rows.filter(l => l.status === 'available').length;
        }),
      );
      const dtos = spots.map((s, i) => ({ ...toSpotDto(s, coords), listingCount: counts[i] }));
      return dtos.sort((a, b) =>
        coords ? (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) : a.name.localeCompare(b.name),
      );
    },

    async getSpot(id, { uid, coords }) {
      const spot = (await getSpots()).find(s => s.id === id);
      if (!spot) throw notFound('spot_not_found', 'That meetup spot does not exist.');

      const rows = (await store.listListingsBySpot(id))
        .filter(l => VISIBLE_STATUSES.includes(l.status))
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 50);
      const alive = await withoutOrphans(rows);
      const wishlist = new Set(await store.getWishlistBookIds(uid));
      return {
        spot: toSpotDto(spot, coords),
        listingCount: alive.filter(l => l.status === 'available').length,
        listings: await toFeedItems(alive, { uid, coords, wishlist }),
      };
    },

    // ----------------------------------------------------------------------- books
    /** Book details enriched with TaleTrade's own community data: who has it and where. */
    async getBook(rawId, { uid, coords }) {
      const id = bookIdOf(rawId);

      let book = null;
      let upstreamError = null;
      try {
        book = await bookProvider.getBook(id);
      } catch (error) {
        upstreamError = error;
      }

      if (!book) {
        // Google Books is unreachable or does not know the id: fall back to what our own data holds.
        const fallback = await store.getBookFallback(id);
        if (fallback) {
          book = {
            id,
            title: fallback.title || 'Untitled',
            authors: splitAuthors(fallback.author),
            publisher: null,
            description: '',
            thumbnail: httpsUrl(fallback.thumbnail),
            isbn: null,
            publishedDate: null,
            pageCount: null,
            categories: [],
            language: null,
            source: 'taletrade',
          };
        } else if (upstreamError) {
          throw new ApiError(502, 'book_provider_unavailable', 'Book details are temporarily unavailable.');
        } else {
          throw notFound('book_not_found', 'That book does not exist.');
        }
      }

      const [ownerCount, listings, spots] = await Promise.all([
        store.countOwners(id),
        store.listListingsByBook(id),
        getSpots(),
      ]);
      const visible = listings.filter(l => VISIBLE_STATUSES.includes(l.status));
      const perSpot = new Map();
      visible.forEach(l => l.spotIds.forEach(spotId => perSpot.set(spotId, (perSpot.get(spotId) || 0) + 1)));
      const availableAt = spots
        .filter(s => perSpot.has(s.id))
        .map(s => ({ ...toSpotDto(s, coords), listingCount: perSpot.get(s.id) }))
        .sort((a, b) => (coords ? (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) : b.listingCount - a.listingCount));
      const mine = listings.find(l => l.ownerId === uid);

      return {
        book,
        community: {
          ownerCount,
          listingCount: visible.length,
          availableCount: visible.filter(l => l.status === 'available').length,
        },
        availableAt,
        myListing: mine ? { id: mine.id, status: mine.status } : null,
      };
    },

    // ------------------------------------------------------------------------ feed
    /** Community feed: visible listings (the caller's own included, flagged isMine), newest first, cursor-paginated. */
    async feed(uid, { filter, coords, radiusKm, limit, cursor }) {
      const wishlistIds = await store.getWishlistBookIds(uid);
      const wanted = new Set(wishlistIds);
      const spotsById = new Map((await getSpots()).map(s => [s.id, s]));

      const isMatch = l => {
        if (!VISIBLE_STATUSES.includes(l.status)) return false;
        if (filter === 'available') return l.status === 'available';
        if (filter === 'wishlist') return l.ownerId !== uid && wanted.has(l.bookId);
        if (filter === 'nearby') {
          const places = [...l.spotIds.map(id => spotsById.get(id)), ...(l.customSpots || [])];
          return places.some(s => {
            return s && Number.isFinite(s.lat) && haversineKm(coords, { lat: s.lat, lng: s.lng }) <= radiusKm;
          });
        }
        return true;
      };

      const batchSize = Math.min(60, limit * 3);
      const matches = [];
      const orphans = [];
      let before = cursor;
      let nextCursor = null;

      for (let round = 0; round < 5; round += 1) {
        const batch = await store.listListingsRecent({ limit: batchSize, before });
        if (batch.length === 0) {
          nextCursor = null;
          break;
        }
        const candidates = batch.filter(isMatch);
        const existing = await store.filterExistingMyBooks(candidates.map(l => [l.ownerId, l.bookId]));
        let full = false;

        for (const l of batch) {
          before = l.updatedAt;
          if (!candidates.includes(l)) continue;
          if (!existing.has(`${l.ownerId}/${l.bookId}`)) {
            orphans.push(l.id);
            continue;
          }
          matches.push(l);
          if (matches.length >= limit) {
            full = true;
            break;
          }
        }

        nextCursor = batch.length < batchSize && !full ? null : before;
        if (full || batch.length < batchSize) break;
      }

      if (orphans.length > 0) store.deleteListings(orphans).catch(() => {});

      return {
        items: await toFeedItems(matches, { uid, coords, wishlist: wanted }),
        nextCursor,
      };
    },

    /** Another reader's visible listings (their profile page), newest first. */
    async userListings(uid, ownerId, { coords } = {}) {
      const rows = (await store.listListingsByOwner(ownerId)).filter(l => VISIBLE_STATUSES.includes(l.status));
      const alive = await withoutOrphans(rows);
      alive.sort((a, b) => b.updatedAt - a.updatedAt);
      const wishlist = new Set(await store.getWishlistBookIds(uid));
      return toFeedItems(alive, { uid, coords, wishlist });
    },

    async myListings(uid, { coords } = {}) {
      const alive = await withoutOrphans(await store.listListingsByOwner(uid));
      alive.sort((a, b) => b.updatedAt - a.updatedAt);
      return {
        items: await toFeedItems(alive, { uid, coords }),
        summary: {
          listed: alive.length,
          available: alive.filter(l => l.status === 'available').length,
          reserved: alive.filter(l => l.status === 'reserved').length,
        },
      };
    },

    /** The user's library, each book flagged with its listing (if any). Feeds the "List a book" picker. */
    async myBooks(uid) {
      const [books, listings] = await Promise.all([store.listMyBooks(uid), store.listListingsByOwner(uid)]);
      const byBook = new Map(listings.map(l => [l.bookId, l]));
      return books
        .map(b => {
          const l = byBook.get(b.bookId);
          return {
            bookId: b.bookId,
            title: b.title || 'Untitled',
            author: b.author || 'Unknown Author',
            thumbnail: httpsUrl(b.thumbnail),
            listing: l ? { id: l.id, status: l.status } : null,
          };
        })
        .sort((a, b) => a.title.localeCompare(b.title));
    },

    // -------------------------------------------------------------------- listings
    async createListing(uid, body) {
      const input = validateCreateListing(body);
      const book = await store.getMyBook(uid, input.bookId);
      if (!book) {
        throw notFound('book_not_in_library', 'Add this book to My Books before listing it.');
      }
      const id = listingId(uid, input.bookId);
      if (await store.getListing(id)) {
        throw conflict('listing_exists', 'This book is already listed. Edit the existing listing instead.');
      }
      await assertSpots(input.spotIds);

      const t = now();
      const listing = {
        id,
        ownerId: uid,
        bookId: input.bookId,
        title: book.title || 'Untitled',
        author: book.author || 'Unknown Author',
        thumbnail: book.thumbnail || null,
        status: input.status,
        condition: input.condition,
        exchange: input.exchange,
        spotIds: input.spotIds,
        customSpots: input.customSpots,
        availableTimes: input.availableTimes,
        note: input.note,
        createdAt: t,
        updatedAt: t,
      };
      await store.saveListing(listing);
      return (await toFeedItems([listing], { uid }))[0];
    },

    async updateListing(uid, id, body) {
      const patch = validateUpdateListing(body);
      const current = await store.getListing(id);
      if (!current) throw notFound('listing_not_found', 'That listing does not exist.');
      if (current.ownerId !== uid) throw forbidden();
      if (!(await store.getMyBook(uid, current.bookId))) {
        await store.deleteListings([id]);
        throw notFound('listing_not_found', 'That listing no longer exists because the book left your library.');
      }
      if (patch.spotIds || patch.customSpots) {
        assertPlaceCount(patch.spotIds ?? current.spotIds, patch.customSpots ?? current.customSpots ?? []);
      }
      if (patch.spotIds) await assertSpots(patch.spotIds);

      const next = { ...patch, updatedAt: now() };
      await store.updateListing(id, next);
      return (await toFeedItems([{ ...current, ...next }], { uid }))[0];
    },

    /** Idempotent for the caller's own ids: deleting an already-removed listing succeeds. */
    async deleteListing(uid, id) {
      const current = await store.getListing(id);
      if (!current) {
        if (id.startsWith(`${uid}_`)) return;
        throw notFound('listing_not_found', 'That listing does not exist.');
      }
      if (current.ownerId !== uid) throw forbidden();
      await store.deleteListings([id]);
    },
  };
};

module.exports = { createService, listingId, toSpotDto, workKey };
