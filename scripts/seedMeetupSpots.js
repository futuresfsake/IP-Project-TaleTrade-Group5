/* eslint-env node */
/**
 * Upserts data/meetupSpots.json into the Firestore `meetupSpots` collection.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json node scripts/seedMeetupSpots.js
 *   (PowerShell: $env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\path\serviceAccount.json')
 *
 * Credentials are read ONLY from GOOGLE_APPLICATION_CREDENTIALS; keep that file outside the repo.
 * Entries with null/invalid coordinates are refused (not written).
 */
const path = require('path');

const slugify = name =>
  name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const hasValidCoordinates = spot =>
  typeof spot.lat === 'number' &&
  typeof spot.lng === 'number' &&
  Number.isFinite(spot.lat) &&
  Number.isFinite(spot.lng) &&
  Math.abs(spot.lat) <= 90 &&
  Math.abs(spot.lng) <= 180;

/** Splits entries into those safe to write and those refused, with a reason. */
const partitionSpots = spots => {
  const valid = [];
  const refused = [];
  spots.forEach(spot => {
    if (!spot.name) {
      refused.push({ spot, reason: 'missing name' });
    } else if (!hasValidCoordinates(spot)) {
      refused.push({ spot, reason: 'null or invalid lat/lng' });
    } else {
      // `verified` is a seed-file bookkeeping flag, not app data.
      const { verified, ...data } = spot;
      valid.push({ id: slugify(spot.name), data });
    }
  });
  return { valid, refused };
};

const main = async () => {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Set GOOGLE_APPLICATION_CREDENTIALS to the path of a service account JSON (outside the repo).');
    process.exit(1);
  }

  const spots = require(path.join(__dirname, '..', 'data', 'meetupSpots.json'));
  const { valid, refused } = partitionSpots(spots);

  refused.forEach(({ spot, reason }) =>
    console.warn(`REFUSED "${spot.name || '(unnamed)'}": ${reason}`),
  );

  if (valid.length === 0) {
    console.error('Nothing to write.');
    process.exit(1);
  }

  const { initializeApp, applicationDefault } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  initializeApp({ credential: applicationDefault() });
  const db = getFirestore();

  const batch = db.batch();
  valid.forEach(({ id, data }) => batch.set(db.collection('meetupSpots').doc(id), data, { merge: true }));
  await batch.commit();

  console.log(`Upserted ${valid.length} spot(s): ${valid.map(v => v.id).join(', ')}`);
  if (refused.length > 0) process.exit(1);
};

if (require.main === module) {
  main().catch(err => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { slugify, hasValidCoordinates, partitionSpots };
