/* eslint-env node */
/**
 * DEV ONLY: runs the real API against an in-memory store so the Feed can be tried without
 * Firebase Admin credentials or Firestore data. Sign-in is still REAL: ID tokens are verified
 * against Google's public keys using only the Firebase project id (read from
 * android/app/google-services.json, or FIREBASE_PROJECT_ID).
 *
 * Every signed-in user gets a small demo library and sees a few demo readers' listings.
 * Nothing is persisted and nothing is written to Firebase. Refuses to start in production.
 */
const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { createApp } = require('./app');
const { createMemoryStore } = require('./store/memoryStore');
const { createGoogleBooksProvider } = require('./bookProvider');
const { partitionSpots } = require('../../scripts/seedMeetupSpots');

if (process.env.NODE_ENV === 'production') {
  console.error('Demo mode is for local development only.');
  process.exit(1);
}

const readProjectId = () => {
  if (process.env.FIREBASE_PROJECT_ID) return process.env.FIREBASE_PROJECT_ID;
  const file = path.join(__dirname, '..', '..', 'android', 'app', 'google-services.json');
  return JSON.parse(fs.readFileSync(file, 'utf8')).project_info.project_id;
};

const cover = id => `http://books.google.com/books/content?id=${id}&printsec=frontcover&img=1&zoom=1&source=gbs_api`;
const book = (bookId, title, author) => ({ bookId, title, author, thumbnail: cover(bookId) });

const DUNE = book('B1hSG45JCX4C', 'Dune', 'Frank Herbert');
const FELLOWSHIP = book('aWZzLPhY4o0C', 'The Fellowship of the Ring', 'J.R.R. Tolkien');
const HOBBIT = book('pD6arNyKyi8C', 'The Hobbit', 'J.R.R. Tolkien');
const VIEWER_LIBRARY = [DUNE, FELLOWSHIP, HOBBIT];
const VIEWER_WISHLIST = ['0N5dEAAAQBAJ'];

const READERS = {
  'demo-maria': { username: 'Maria Santos', library: [book('0N5dEAAAQBAJ', 'Circe', 'Madeline Miller'), book('yI0nAAAAMAAJ', 'Normal People', 'Sally Rooney')] },
  'demo-paolo': { username: 'Paolo Lim', library: [book('xEx7DwAAQBAJ', 'Educated', 'Tara Westover')] },
  'demo-ana': { username: 'Ana Reyes', library: [book('3Wr4DwAAQBAJ', 'Gone Girl', 'Gillian Flynn')] },
};

const spotsFile = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'meetupSpots.json'), 'utf8'));
const spots = partitionSpots(spotsFile).valid.map(({ id, data }) => ({ id, ...data }));
const spotId = i => spots[i % spots.length].id;

const hour = 3600000;
const t0 = Date.now();
const listingFor = (uid, b, i, over) => ({
  id: `${uid}_${b.bookId}`, ownerId: uid, bookId: b.bookId, title: b.title, author: b.author, thumbnail: b.thumbnail,
  status: 'available', condition: 'good', exchange: ['trade', 'lend'], spotIds: [spotId(i), spotId(i + 1)],
  availableTimes: 'Weekends, after 3 PM', note: '', createdAt: t0 - (i + 1) * 2 * hour, updatedAt: t0 - (i + 1) * 2 * hour, ...over,
});
const listings = [
  listingFor('demo-maria', READERS['demo-maria'].library[0], 0, { condition: 'like_new', note: 'Happy to trade for fantasy!' }),
  listingFor('demo-paolo', READERS['demo-paolo'].library[0], 1, { exchange: ['lend'], condition: 'fair' }),
  listingFor('demo-ana', READERS['demo-ana'].library[0], 2, { status: 'reserved', exchange: ['give_away'] }),
  listingFor('demo-maria', READERS['demo-maria'].library[1], 3, { condition: 'good' }),
];

const base = createMemoryStore({
  spots,
  users: Object.fromEntries(Object.entries(READERS).map(([uid, r]) => [uid, { username: r.username }])),
  myBooks: Object.fromEntries(Object.entries(READERS).map(([uid, r]) => [uid, r.library])),
  listings,
});

const demoReader = uid => uid in READERS;
const viewerHas = id => VIEWER_LIBRARY.some(b => b.bookId === id);

// Any real signed-in user is the "viewer": they get VIEWER_LIBRARY as their library.
const store = {
  ...base,
  async getUsers(uids) {
    const out = await base.getUsers(uids);
    uids.forEach(uid => {
      if (!demoReader(uid)) out[uid] = { username: 'You' };
    });
    return out;
  },
  async listMyBooks(uid) {
    return demoReader(uid) ? base.listMyBooks(uid) : VIEWER_LIBRARY.map(b => ({ ...b }));
  },
  async getMyBook(uid, bookId) {
    if (demoReader(uid)) return base.getMyBook(uid, bookId);
    const hit = VIEWER_LIBRARY.find(b => b.bookId === bookId);
    return hit ? { ...hit } : null;
  },
  async filterExistingMyBooks(pairs) {
    const existing = await base.filterExistingMyBooks(pairs.filter(([uid]) => demoReader(uid)));
    pairs.forEach(([uid, bookId]) => {
      if (!demoReader(uid) && viewerHas(bookId)) existing.add(`${uid}/${bookId}`);
    });
    return existing;
  },
  async getWishlistBookIds(uid) {
    return demoReader(uid) ? [] : [...VIEWER_WISHLIST];
  },
  async countOwners() {
    return 3;
  },
};

initializeApp({ projectId: readProjectId() });
const app = createApp({
  store,
  bookProvider: createGoogleBooksProvider({ apiKey: process.env.GOOGLE_BOOKS_API_KEY }),
  verifyToken: token => getAuth().verifyIdToken(token),
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`TaleTrade API (DEMO, in-memory) listening on :${port}`));
