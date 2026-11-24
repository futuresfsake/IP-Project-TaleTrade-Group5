# TaleTrade

A book lending mobile app built with React Native and Firebase.

## Folder Structure

```
TaleTrade/
├── App.tsx                  # Root component — handles auth state and navigation
├── index.js                 # App entry point
├── .env                     # Environment variables (Google Books + MapTiler API keys)
├── env.d.ts                 # Type declarations for the `@env` variables
├── firebase.json            # Points the Firebase CLI at firestore.rules
├── firestore.rules          # Firestore security rules (deployed manually)
├── src/
│   ├── api/
│   ├── assets/
│   │   ├── Logo.png
│   │   ├── Logo.svg
│   │   ├── logoNoBg.png
│   │   └── logoWbg.png
│   ├── component/
│   │   ├── BookCard.tsx         # Reusable book card component
│   │   ├── map/
│   │   │   ├── SpotList.tsx     # List of meetup spots (distance, nearest-first sort)
│   │   │   └── SpotSheet.tsx    # Bottom sheet with the books available at a spot
│   │   └── TabBar.tsx           # Custom bottom tab bar
│   ├── navigation/
│   │   ├── AuthNavigator.tsx    # Auth flow (Launch → Login → Register)
│   │   ├── TabNavigator.tsx     # Main app bottom tabs
│   │   └── DrawerNavigator.tsx  # Drawer navigation (unused)
│   ├── screens/
│   │   ├── auth/
│   │   │   ├── LoginScreen.tsx
│   │   │   └── RegisterScreen.tsx
│   │   ├── map/
│   │   │   └── MapScreen.tsx    # Map tab: meetup spots, spot sheet, center on me
│   │   ├── BookDetailScreen.tsx
│   │   ├── GenreDetailScreen.tsx
│   │   ├── HomeScreen.tsx
│   │   ├── LaunchScreen.tsx
│   │   ├── MyBooksScreen.tsx
│   │   ├── PickAGenreScreen.tsx # Onboarding genre selection
│   │   ├── ProfileScreen.tsx
│   │   ├── SearchScreen.tsx
│   │   ├── SettingScreen.tsx
│   │   └── WishlistScreen.tsx
│   ├── services/
│   │   ├── authService.ts       # Firebase Auth (register/login)
│   │   ├── bookService.ts       # Google Books API calls
│   │   ├── genreService.ts      # User genre preferences (Firestore)
│   │   ├── map/
│   │   │   ├── locationService.ts # On-device location (permission, one-shot position, distance helpers)
│   │   │   └── meetupService.ts   # Meetup spots, preferred spots, books-at-spot queries (Firestore)
│   │   ├── userService.ts       # User profile data (Firestore)
│   │   └── userbookService.ts   # User's book collection (Firestore)
│   └── types/
│       └── index.ts             # TypeScript type definitions
├── data/
│   └── meetupSpots.json         # Curated meetup spots used by the seed script
├── scripts/
│   └── seedMeetupSpots.js       # Upserts data/meetupSpots.json into Firestore (Admin SDK)
├── __tests__/                   # Jest tests (App.test.tsx, meetup.test.ts)
├── __mocks__/
│   └── env.js                   # Test stand-in for the `@env` module
├── android/                     # Android native project
│   └── app/
│       ├── google-services.json # Firebase Android config
│       └── src/main/java/com/taletrade/
│           ├── MainActivity.kt
│           └── MainApplication.kt
├── package.json
├── tsconfig.json
└── metro.config.js
```

## Prerequisites

- Node.js >= 22.11.0
- Android Studio with an Android emulator (or a physical device)
- Android SDK with `ANDROID_HOME` environment variable set
- Java Development Kit (JDK)

## How to Run

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Set up environment variables**

   Create a `.env` file in the project root with:

   ```
   GOOGLE_BOOKS_API_KEY=your_google_books_api_key
   MAPTILER_API_KEY=your_maptiler_api_key
   ```

   `MAPTILER_API_KEY` is used for the Map tab tiles (create a key in your MapTiler account). Without it the Map tab shows an error screen.

   Use `=` with no quotes or trailing `;`. After changing `.env`, restart Metro with `npx react-native start --reset-cache`.

   **Firebase config:** `android/app/google-services.json` is gitignored. Download it from the Firebase console
   (Project settings → Your apps → Android, package `com.taletrade`) or get it from a teammate, and place it in `android/app/`.

3. **Start Metro bundler**

   ```bash
   npx react-native start
   ```

4. **Run on Android** (in a separate terminal)

   ```bash
   npx react-native run-android
   ```

   If the emulator can't connect to Metro, run:

   ```bash
   adb reverse tcp:8081 tcp:8081
   ```

## Meetup Points Setup

The Map tab shows curated public meetup places (malls, campus libraries, etc.), never users' locations. These one-time steps are manual:

1. **Deploy the Firestore rules** (they add `meetupSpots`, the collection-group read on `owners`, and owner-doc updates):

   ```bash
   firebase deploy --only firestore:rules
   ```

   (or paste `firestore.rules` into Firebase console → Firestore → Rules → Publish).

2. **Enable the collection-group index** used to find books at a spot: Firebase console → Firestore → Indexes → *Single field* → *Add exemption* → Collection ID `owners`, field path `spotIds`, enable **Array contains** at the *Collection group* scope. Without it, spot queries fail with a "requires an index" error.

3. **Seed the spots.** Fill in `lat`, `lng`, `address` and `openHours` in `data/meetupSpots.json` (set `"verified": true` once checked), download a service-account key from Firebase console → Project settings → Service accounts → *Generate new private key*, keep it **outside the repo**, then:

   ```powershell
   $env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\keys\serviceAccount.json'
   node scripts/seedMeetupSpots.js
   ```

   The script reads credentials only from `GOOGLE_APPLICATION_CREDENTIALS`, upserts spots with ids derived from their names, and refuses entries with null or invalid coordinates. `serviceAccount*.json` is gitignored.

4. **Users pick their spots** in Settings → "Where I can meet" (up to 3). Saving also updates the user's existing owner docs.

If `npm install` reports a peer-dependency conflict involving `expo`, use `npm install --legacy-peer-deps` (`cloudinary-react-native` pulls in `expo@53`, while the optional `expo` peer of `@maplibre/maplibre-react-native` asks for `>=54`; the app does not use Expo).

After adding the MapLibre dependency, rebuild the app (`npx react-native run-android`); a JS reload is not enough.

## API Reference

### External API — Google Books

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/books/v1/volumes?q={query}&maxResults={n}&key={API_KEY}` | Fetch books by genre. Genre names are mapped to search queries via `GENRE_QUERY_MAP` in `bookService.ts` (e.g. `Fantasy` → `fantasy fiction`) | No (API key only) |
| `GET` | `/books/v1/volumes?q={query}&maxResults={n}&key={API_KEY}` | Search books by title, author, or ISBN | No (API key only) |

Base URL: `https://www.googleapis.com/books/v1`

### Firebase Auth (`authService.ts`)

| Method | Operation | Description | Auth Required |
|--------|-----------|-------------|---------------|
| `CREATE` | `createUserWithEmailAndPassword(email, password)` | Register a new user and create their Firestore profile | No |
| `READ` | `signInWithEmailAndPassword(email, password)` | Log in an existing user | No |
| `LISTEN` | `onAuthStateChanged()` | Subscribe to auth state changes (used in `App.tsx`) | No |
| `LISTEN` | `onIdTokenChanged()` | Subscribe to user profile/token changes (used in `App.tsx`) | Yes |

### Firestore — Users Collection (`userService.ts`)

Collection: `Users/{uid}`

| Method | Operation | Description | Auth Required |
|--------|-----------|-------------|---------------|
| `READ` | `getUserProfile(uid)` | Get a user's full profile document | Yes |
| `READ` | `getUsername(uid)` | Get only the username field for a user | Yes |
| `WRITE` | `updateUserBio(uid, bio)` | Update user's bio field | Yes |
| `WRITE` | `updateUserInDb(uid, username)` | Update user's username | Yes |
| `WRITE` | `updateUserProfileImage(uid, imageUrl)` | Update user's profile photo URL | Yes |
| `WRITE` | `updateUserSocialLink(uid, link)` | Update user's social media link | Yes |

### Firestore — Genre Preferences (`genreService.ts`)

Collection: `Users/{uid}` (genres field)

| Method | Operation | Description | Auth Required |
|--------|-----------|-------------|---------------|
| `READ` | `getUserGenres()` | Get the current user's saved genre preferences | Yes |
| `WRITE` | `saveUserGenres(uid, genres)` | Save/update genre preferences for a user | Yes |

### Firestore — User Books (`userbookService.ts`)

Collections: `Users/{uid}/myBooks/{bookId}`, `Users/{uid}/wishlist/{bookId}`, `bookOwners/{bookId}/owners/{uid}`

| Method | Operation | Description | Auth Required |
|--------|-----------|-------------|---------------|
| `READ` | `getUserInventory(userId?)` | Get all books in a user's inventory | Yes |
| `READ` | `getBookOwners(bookId)` | Get all users who own a specific book (each with their `spotIds`) | Yes |
| `WRITE` | `addBookToUserInventory(bookData)` | Add a book to user's inventory and register as owner; the owner doc also gets `bookId`, `title`, `author`, `thumbnail` and the user's `preferredSpots` as `spotIds` | Yes |
| `WRITE` | `addToWishlist(bookData)` | Add a book to user's wishlist | Yes |
| `WRITE` | `updateBookStatus(bookId, status)` | Update the status of a book in inventory | Yes |
| `DELETE` | `removeBookFromInventory(bookId)` | Remove a book from inventory and owner registry | Yes |

### Firestore — Wishlist (inline in `WishlistScreen.tsx`)

Collection: `Users/{uid}/wishlist/{bookId}`

| Method | Operation | Description | Auth Required |
|--------|-----------|-------------|---------------|
| `LISTEN` | `onSnapshot(Users/{uid}/wishlist)` | Real-time listener for wishlist updates | Yes |
| `DELETE` | `deleteDoc(Users/{uid}/wishlist/{bookId})` | Remove a book from the wishlist | Yes |

### Firestore — Meetup Spots (`map/meetupService.ts`)

Collections: `meetupSpots/{spotId}`, `Users/{uid}` (field `preferredSpots`), `bookOwners/{bookId}/owners/{uid}`

**`meetupSpots/{spotId}`** (curated, written only by the seed script; the app can read, not write): `name`, `type` (`mall` | `library` | `bookstore` | `cafe` | `campus` | `other`), `lat`, `lng`, `address`, `city`, `openHours`, `safetyNote` (optional), `active`.

**`Users/{uid}.preferredSpots`**: array of up to 3 spot ids.

**`bookOwners/{bookId}/owners/{uid}`** (extended): `userId`, `addedAt`, plus `bookId`, `title`, `author`, `thumbnail` and `spotIds` (a copy of the owner's `preferredSpots`, at most 3).

| Method | Operation | Description | Auth Required |
|--------|-----------|-------------|---------------|
| `READ` | `getActiveSpots()` | All spots with `active == true` (throws on failure) | Yes |
| `READ` | `getSpot(id)` | One spot, or `null` | Yes |
| `READ` | `getBooksAtSpot(spotId)` | **Collection-group query** on `owners` where `spotIds` array-contains the spot id; returns `bookId`, `title`, `author`, `thumbnail`, `ownerId` per owner/book pair (throws on failure) | Yes |
| `READ` | `getSpotAvailability(wishlistBookIds?, excludeUserId?)` | Per active spot: `counts` (owner/book pairs) and `wishlistCounts` (pairs matching the wishlist, ignoring `excludeUserId`); uses `array-contains-any` collection-group queries in chunks of 30 and aggregates in the app | Yes |
| `READ` | `getSpotBookCounts()` | `counts` from `getSpotAvailability` | Yes |
| `READ` | `getSpotIdsForBook(bookId)` | Union of the spot ids chosen by everyone who owns the book | Yes |
| `READ` | `getWishlistBookIds(uid)` | Ids in `Users/{uid}/wishlist` (empty on failure) | Yes |
| `READ` | `getPreferredSpots(uid)` | The user's `preferredSpots` (empty on failure) | Yes |
| `WRITE` | `setPreferredSpots(uid, spotIds)` | Saves `preferredSpots` (max 3) and rewrites `spotIds` + denormalized fields on every owner doc built from the user's `myBooks` (batches of 400) | Yes |

Pure helpers in the same file (unit-tested in `__tests__/meetup.test.ts`): `toggleSpotSelection`, `buildOwnerFields`, `groupBooksByBookId`, `filterBooks`, `tallySpotCounts`, `tallyWishlistSpots`, `uniqueSpotIds`, `computeMapView`, `chunk`.

### On-device Location (`map/locationService.ts`)

Not a Firestore API: the user's position is used only to centre the map and compute distances. It is kept in component state, never written to Firestore, AsyncStorage or logs. Foreground only (`ACCESS_COARSE_LOCATION` / `ACCESS_FINE_LOCATION`).

| Operation | Description |
|-----------|-------------|
| `requestLocationPermission()` | Shows the Android prompt only if needed; resolves `granted`, `denied` or `blocked` ("never ask again") |
| `getUserLocation()` | One-shot read of the device's last known position via MapLibre's `LocationManager`; resolves `ok` with coordinates, or `denied` / `blocked` / `unavailable` |
| `haversineKm(a, b)`, `formatDistance(km)`, `sortByDistance(items, fn)` | Pure helpers (unit-tested) |
