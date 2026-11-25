/* eslint-env node */
/**
 * In-memory implementation of the store interface. Used by the test-suite and handy for
 * local experiments; the production implementation is firestoreStore.js.
 */
const createMemoryStore = ({ spots = [], users = {}, myBooks = {}, wishlists = {}, owners = {}, listings = [] } = {}) => {
  const listingMap = new Map(listings.map(l => [l.id, { ...l }]));
  const ownerCounts = { ...owners };

  return {
    async getSpots() {
      return spots.filter(s => s.active !== false).map(s => ({ ...s }));
    },
    async getUsers(uids) {
      const out = {};
      uids.forEach(uid => {
        if (users[uid]) out[uid] = { ...users[uid] };
      });
      return out;
    },
    async getMyBook(uid, bookId) {
      return (myBooks[uid] || []).find(b => b.bookId === bookId) || null;
    },
    async listMyBooks(uid) {
      return (myBooks[uid] || []).map(b => ({ ...b }));
    },
    async filterExistingMyBooks(pairs) {
      const existing = new Set();
      pairs.forEach(([uid, bookId]) => {
        if ((myBooks[uid] || []).some(b => b.bookId === bookId)) existing.add(`${uid}/${bookId}`);
      });
      return existing;
    },
    async getWishlistBookIds(uid) {
      return [...(wishlists[uid] || [])];
    },
    async countOwners(bookId) {
      return ownerCounts[bookId] || 0;
    },
    async getBookFallback(bookId) {
      for (const list of Object.values(myBooks)) {
        const hit = list.find(b => b.bookId === bookId);
        if (hit) return { id: bookId, title: hit.title, author: hit.author, thumbnail: hit.thumbnail || null };
      }
      return null;
    },
    async getListing(id) {
      const l = listingMap.get(id);
      return l ? { ...l } : null;
    },
    async listListingsRecent({ limit, before }) {
      return [...listingMap.values()]
        .filter(l => before === null || before === undefined || l.updatedAt < before)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, limit)
        .map(l => ({ ...l }));
    },
    async listListingsByOwner(uid) {
      return [...listingMap.values()].filter(l => l.ownerId === uid).map(l => ({ ...l }));
    },
    async listListingsByBook(bookId) {
      return [...listingMap.values()].filter(l => l.bookId === bookId).map(l => ({ ...l }));
    },
    async listListingsBySpot(spotId) {
      return [...listingMap.values()].filter(l => l.spotIds.includes(spotId)).map(l => ({ ...l }));
    },
    async saveListing(listing) {
      listingMap.set(listing.id, { ...listing });
    },
    async updateListing(id, patch) {
      const current = listingMap.get(id);
      if (current) listingMap.set(id, { ...current, ...patch });
    },
    async deleteListings(ids) {
      ids.forEach(id => listingMap.delete(id));
    },
    // Test helpers.
    _listings: () => [...listingMap.values()],
    _removeMyBook(uid, bookId) {
      myBooks[uid] = (myBooks[uid] || []).filter(b => b.bookId !== bookId);
    },
  };
};

module.exports = { createMemoryStore };
