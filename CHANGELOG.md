# Changelog

## 2026-11-24 — Meetup Points & Map tab

Readers pick up to 3 public meetup places; a new **Map** tab shows those places and the books available at each. The map shows curated public places only — no user's location is stored or displayed. This replaces the earlier location-sharing design for BL-017/018/019 (see `BACKLOG.md`).

### Data model

| Where | Change |
|-------|--------|
| `meetupSpots/{spotId}` (new collection) | Curated spots: `name`, `type`, `lat`, `lng`, `address`, `city`, `openHours`, `safetyNote`, `active`. Read-only from the app; seeded with `scripts/seedMeetupSpots.js`. |
| `Users/{uid}.preferredSpots` | New field: up to 3 spot ids. |
| `bookOwners/{bookId}/owners/{uid}` | Extended with `bookId`, `title`, `author`, `thumbnail`, `spotIds` (copy of the owner's `preferredSpots`). Existing `userId` / `addedAt` unchanged. |

### Firestore rules (`firestore.rules`)

- `meetupSpots`: signed-in read, no client writes.
- Owner docs may now be **updated** by their owner (`userId` must stay the user's uid); `spotIds`, when present, must be a list of at most 3 (create and update).
- New read-only collection-group rule on `owners`.
- `Users/{uid}/myBooks/{id}` is readable by signed-in users (fixes `permission-denied` when opening another user's profile); other `Users/{uid}/...` data stays owner-only.
- **Rules are deployed manually**, and a collection-group index on `owners.spotIds` (array-contains) must be enabled — see `README.md` → "Meetup Points Setup".

### Features

- **Settings → "Where I can meet"**: multi-select of active spots (max 3, message when the limit is hit). Saving runs `setPreferredSpots`, which also rewrites `spotIds` and the denormalized fields on all of the user's existing owner docs (batches of 400), backfilling older docs.
- **Map tab** (6th tab, between Wishlist and Profile, `MapPin` icon): MapLibre map with MapTiler tiles (`MAPTILER_API_KEY`), one marker per spot with a book-count badge, loading / empty / error states.
- **Spot sheet**: books grouped by book with owner counts, wishlist matches first with a "★ On your wishlist" badge, 20 per page with "Show more", title/author search when a spot has more than 10 books, expandable owner list linking to profiles, collapsible spot info.
- **BookDetail**: each owner shows their meetup spot names; "View on map" opens the Map tab filtered to spots that have the book.
- **Wishlist highlight**: spots with a book from your wishlist get a gold star marker and legend.
- **Center on me**: foreground-only location permission requested when the Map tab opens; blue dot, "locate me" button, distances, and a spot list with "Nearest first". The position is used in memory only (never written to Firestore, AsyncStorage or logs). Without permission the map works with its default view and no distances; "never ask again" offers an Open settings alert.
- **Profile**: shows the user's meetup spots ("Where I can meet").

### Files

| File | Change |
|------|--------|
| `src/services/map/meetupService.ts` (new) | Spot queries, preferred-spot saving, availability counts, plus pure helpers (grouping, filtering, selection limit, tallies, map view). |
| `src/services/map/locationService.ts` (new) | Permission + one-shot position, `haversineKm`, `formatDistance`, `sortByDistance`. |
| `src/screens/map/MapScreen.tsx` (new) | Map tab screen. |
| `src/component/map/SpotSheet.tsx`, `src/component/map/SpotList.tsx` (new) | Spot sheet and spot list. |
| `src/services/userbookService.ts` | `addBookToUserInventory` writes the denormalized owner fields from the user's `preferredSpots`; `getBookOwners` also returns each owner's `spotIds`. |
| `src/screens/SettingScreen.tsx`, `BookDetailScreen.tsx`, `ProfileScreen.tsx` | Spot picker; owner spots + "View on map"; spots on profiles. |
| `src/navigation/TabNavigator.tsx`, `src/component/TabBar.tsx` | Map tab; `MapPin` icon; tab padding 12 → 8 for six tabs. |
| `src/types/index.ts` | `MeetupSpot`, `MeetupSpotType`, `SpotBook`. |
| `android/app/src/main/AndroidManifest.xml` | `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION` (no background location). |
| `data/meetupSpots.json`, `scripts/seedMeetupSpots.js` (new) | Spot data and Admin-SDK seed script (credentials from `GOOGLE_APPLICATION_CREDENTIALS`; refuses null coordinates). |
| `env.d.ts` | Declares `MAPTILER_API_KEY`. |
| `.gitignore` | Ignores `serviceAccount*.json` and `*-firebase-adminsdk-*.json`. |
| `package.json` | Added `@maplibre/maplibre-react-native` (installed with `--legacy-peer-deps`; see README) and `firebase-admin` (dev). |
| `__tests__/meetup.test.ts`, `jest.setup.js`, `__mocks__/env.js` | Unit tests for the pure helpers; Jest mock for the MapLibre module; `eslint-env jest` so lint passes; test `MAPTILER_API_KEY`. |

### Backlog

- BL-017 (meetup points + map) and BL-019 (Map tab): **DONE**. BL-018: **PARTIAL** (not implemented: map search by book/genre, a "books near me" list of books, push notification for wishlisted books — see `BACKLOG.md`).

## 2026-11-23 — Test Branch Push: Cleanup & Documentation

Changes bundled for the push to the `test` branch. The Firebase modular migration and its related fixes (below, dated 2026-10-27) ship in the same push; this entry covers the additional cleanup and documentation work.

### Code cleanup

| File | Change |
|------|--------|
| `src/services/authService.ts` | Removed the ~35-line commented-out legacy copy of `registerUser` / `loginUser`. Removed inline step comments. Default bio on registration changed from `"Hello! I'm new here and ready to trade tales. 📚"` to the same text **without the 📚 emoji** (affects new accounts only). |
| `src/services/userService.ts` | Removed JSDoc blocks and inline comments. Renamed local `doc` variables to `snapshot` to avoid shadowing the modular `doc()` import. No behavior change. |
| `src/services/userbookService.ts` | Removed JSDoc blocks and inline comments. Renamed loop variables `doc` → `d` to avoid shadowing the modular `doc()` import. No behavior change. |
| `src/services/genreService.ts` | Removed comments, tidied blank lines, added trailing newline. |
| `src/services/bookService.ts` | Removed the old commented-out `fetchBooksByGenre`. (The `GENRE_QUERY_MAP` fix itself is logged under 2026-10-27.) |
| `src/screens/PickAGenreScreen.tsx` | Removed step comments around `updateProfile` / `reload`. |
| `src/navigation/AuthNavigator.tsx` | Removed unused `auth` import. |

### Documentation

- `README.md`: Replaced the one-line description with full project documentation — folder structure, prerequisites, how to run (Metro, `run-android`, `adb reverse`), and an API reference for Google Books, Firebase Auth, and every Firestore service.
- `BACKLOG.md` (new): Product backlog from the 2026-10-27 audit — deployment phases and ticket reference table (BL-001 onward).
- `CHANGELOG.md` (new): This file.

- `README.md` API reference updated to match the code: `onUserChanged()` → `onIdTokenChanged()`, and the Google Books genre query now documents `GENRE_QUERY_MAP`.

## 2026-10-27 — Firebase Modular API Migration

Migrated all React Native Firebase calls from the deprecated **namespaced API** to the new **modular API** to eliminate deprecation warnings and prepare for the next major release of `@react-native-firebase`.

### What changed

The namespaced API (`auth()`, `firestore()`, `firestore.FieldValue.serverTimestamp()`) was replaced with tree-shakeable modular imports (`getAuth()`, `getFirestore()`, `serverTimestamp()`, etc.) across **11 files**.

### Files modified

| File | Changes |
|------|---------|
| `App.tsx` | `auth()` → `getAuth()`, `auth().onAuthStateChanged()` → `onAuthStateChanged(auth, ...)`, `auth().onUserChanged()` → `onIdTokenChanged(auth, ...)` (see fix below) |
| `src/services/authService.ts` | `auth().createUserWithEmailAndPassword()` → `createUserWithEmailAndPassword(getAuth(), ...)`, `firestore().collection().doc().set()` → `setDoc(doc(...))`, `firestore.FieldValue.serverTimestamp()` → `serverTimestamp()` |
| `src/services/userService.ts` | `firestore().collection().doc().get()` → `getDoc(doc(...))`, `firestore().collection().doc().set()` → `setDoc(doc(...))`, `firestore.FieldValue.serverTimestamp()` → `serverTimestamp()` |
| `src/services/genreService.ts` | `auth().currentUser` → `getAuth().currentUser`, `firestore().collection().doc().set()` → `setDoc(doc(...))`, `firestore().collection().doc().get()` → `getDoc(doc(...))` |
| `src/services/userbookService.ts` | `firestore().batch()` → `writeBatch(getFirestore())`, all collection/doc chains → `doc(db, 'path', 'segments')` and `collection(db, 'path', 'segments')`, `firestore.FieldValue.serverTimestamp()` → `serverTimestamp()` |
| `src/screens/HomeScreen.tsx` | `auth().currentUser` → `getAuth().currentUser` |
| `src/screens/ProfileScreen.tsx` | `auth().currentUser` → `getAuth().currentUser` |
| `src/screens/SettingScreen.tsx` | `auth().currentUser` → `getAuth().currentUser`, `auth().signOut()` → `firebaseSignOut(getAuth())`, `firestore().collection().doc().delete()` → `deleteDoc(doc(...))`, `user.delete()` → `deleteUser(user)` |
| `src/screens/WishlistScreen.tsx` | `firestore().collection().onSnapshot()` → `onSnapshot(collection(...))`, `firestore().collection().doc().delete()` → `deleteDoc(doc(...))` |
| `src/screens/PickAGenreScreen.tsx` | `auth().currentUser` → `getAuth().currentUser`, `user.updateProfile()` → `updateProfile(user, ...)`, `user.reload()` → `reload(user)` |
| `src/navigation/AuthNavigator.tsx` | Removed unused `auth` import |

### Migration pattern reference

**Before (namespaced):**
```ts
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

auth().onAuthStateChanged(callback);
auth().currentUser;
firestore().collection('Users').doc(uid).get();
firestore().collection('Users').doc(uid).set(data, { merge: true });
firestore.FieldValue.serverTimestamp();
```

**After (modular):**
```ts
import { getAuth, onAuthStateChanged } from '@react-native-firebase/auth';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from '@react-native-firebase/firestore';

onAuthStateChanged(getAuth(), callback);
getAuth().currentUser;
getDoc(doc(getFirestore(), 'Users', uid));
setDoc(doc(getFirestore(), 'Users', uid), data, { merge: true });
serverTimestamp();
```

### Other fixes applied

- `App.tsx`: Replaced `onUserChanged` (not available in modular API) with `onIdTokenChanged` to fix white-screen crash after migration.
- `src/screens/HomeScreen.tsx`: Changed `Promise.all` (12 parallel Google Books API requests) to a sequential `for...of` loop to prevent API rate-limiting.
- `src/services/bookService.ts`: Fixed empty genre sections — Google Books API returned 0 results for most genre names when using `subject:` prefix (only "Self-Help" worked). Replaced with a genre-to-query mapping using plain `q=` search (`"Contemporary"` → `"contemporary fiction"`, `"Fantasy"` → `"fantasy fiction"`, etc.), which returns hundreds of results for every genre.
