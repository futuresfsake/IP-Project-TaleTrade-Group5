/* eslint-env node */
/**
 * Production entry point. Requires Firebase Admin credentials (GOOGLE_APPLICATION_CREDENTIALS,
 * or default credentials on Cloud Run / GCE). See server/README.md.
 */
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { createApp } = require('./app');
const { createFirestoreStore } = require('./store/firestoreStore');
const { createGoogleBooksProvider } = require('./bookProvider');
const { createMapTilerProvider } = require('./placeProvider');

initializeApp({ credential: applicationDefault() });

const app = createApp({
  store: createFirestoreStore(),
  bookProvider: createGoogleBooksProvider({ apiKey: process.env.GOOGLE_BOOKS_API_KEY }),
  placeProvider: createMapTilerProvider({ apiKey: process.env.MAPTILER_API_KEY }),
  verifyToken: token => getAuth().verifyIdToken(token),
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`TaleTrade API listening on :${port}`));
