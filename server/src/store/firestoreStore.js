/* eslint-env node */
/**
 * Firestore (Admin SDK) implementation of the store interface. It reads the collections
 * the mobile app already writes (Users, meetupSpots, bookOwners) and owns `listings`,
 * which only this API may write (see firestore.rules).
 */
const { getFirestore } = require('firebase-admin/firestore');

const createFirestoreStore = (db = getFirestore()) => {
  const listings = db.collection('listings');
  const withId = d => ({ id: d.id, ...d.data() });

  return {
    async getSpots() {
      const snap = await db.collection('meetupSpots').where('active', '==', true).get();
      return snap.docs.map(withId);
    },

    async getUsers(uids) {
      const unique = Array.from(new Set(uids));
      if (unique.length === 0) return {};
      const snaps = await db.getAll(...unique.map(uid => db.collection('Users').doc(uid)));
      const out = {};
      snaps.forEach(s => {
        if (s.exists) out[s.id] = s.data();
      });
      return out;
    },

    async getMyBook(uid, bookId) {
      const snap = await db.collection('Users').doc(uid).collection('myBooks').doc(bookId).get();
      return snap.exists ? { bookId, ...snap.data() } : null;
    },

    async listMyBooks(uid) {
      const snap = await db.collection('Users').doc(uid).collection('myBooks').get();
      return snap.docs.map(d => ({ bookId: d.id, ...d.data() }));
    },

    /** Every book in every library (an unfiltered collection-group read needs no index). */
    async listOwnedBooks() {
      const snap = await db.collectionGroup('myBooks').select('title', 'author', 'thumbnail').get();
      return snap.docs.map(d => ({ ownerId: d.ref.parent.parent.id, bookId: d.id, ...d.data() }));
    },

    async listAllListings() {
      const snap = await listings.get();
      return snap.docs.map(withId);
    },

    /** One batched read: which of these [uid, bookId] pairs still exist in a user's library. */
    async filterExistingMyBooks(pairs) {
      const existing = new Set();
      if (pairs.length === 0) return existing;
      const refs = pairs.map(([uid, bookId]) => db.collection('Users').doc(uid).collection('myBooks').doc(bookId));
      const snaps = await db.getAll(...refs);
      snaps.forEach((s, i) => {
        if (s.exists) existing.add(`${pairs[i][0]}/${pairs[i][1]}`);
      });
      return existing;
    },

    async getWishlistBookIds(uid) {
      const snap = await db.collection('Users').doc(uid).collection('wishlist').get();
      return snap.docs.map(d => d.id);
    },

    async countOwners(bookId) {
      const snap = await db.collection('bookOwners').doc(bookId).collection('owners').count().get();
      return snap.data().count;
    },

    /** Denormalised title/author/thumbnail from the owners subcollection, used when Google Books is down. */
    async getBookFallback(bookId) {
      const snap = await db.collection('bookOwners').doc(bookId).collection('owners').limit(1).get();
      if (snap.empty) return null;
      const d = snap.docs[0].data();
      return { id: bookId, title: d.title, author: d.author, thumbnail: d.thumbnail || null };
    },

    async getListing(id) {
      const snap = await listings.doc(id).get();
      return snap.exists ? withId(snap) : null;
    },

    async listListingsRecent({ limit, before }) {
      let q = listings.orderBy('updatedAt', 'desc');
      if (before !== null && before !== undefined) q = q.startAfter(before);
      const snap = await q.limit(limit).get();
      return snap.docs.map(withId);
    },

    async listListingsByOwner(uid) {
      const snap = await listings.where('ownerId', '==', uid).get();
      return snap.docs.map(withId);
    },

    async listListingsByBook(bookId) {
      const snap = await listings.where('bookId', '==', bookId).get();
      return snap.docs.map(withId);
    },

    async listListingsBySpot(spotId) {
      const snap = await listings.where('spotIds', 'array-contains', spotId).get();
      return snap.docs.map(withId);
    },

    async saveListing(listing) {
      const { id, ...data } = listing;
      await listings.doc(id).set(data);
    },

    async updateListing(id, patch) {
      await listings.doc(id).update(patch);
    },

    async deleteListings(ids) {
      if (ids.length === 0) return;
      const batch = db.batch();
      ids.forEach(id => batch.delete(listings.doc(id)));
      await batch.commit();
    },
  };
};

module.exports = { createFirestoreStore };
