# TaleTrade — Product Backlog

**Audit Date:** 2026-10-27  
**App:** TaleTrade (React Native 0.85 + TypeScript + Firebase)  
**Purpose:** A book-trading social platform where readers discover, own, wishlist, and trade books with nearby users.

---

## Table of Contents

1. [Deployment Phases](#deployment-phases)
2. [Phase 1 — Critical Fixes & Stability](#phase-1--critical-fixes--stability)
3. [Phase 2 — Auth Hardening & UX Polish](#phase-2--auth-hardening--ux-polish)
4. [Phase 3 — Real-Time Chat & Push Notifications](#phase-3--real-time-chat--push-notifications)
5. [Phase 4 — Meetup Points & Map](#phase-4--meetup-points--map)
6. [Phase 5 — Trade System (Core Feature)](#phase-5--trade-system-core-feature)
7. [Phase 6 — Social Features & Profile Enhancements](#phase-6--social-features--profile-enhancements)
8. [Phase 7 — Code Quality & Tech Debt](#phase-7--code-quality--tech-debt)
9. [Ticket Reference Table](#ticket-reference-table)

---

## Deployment Phases

| Phase | Name | Priority | Estimated Effort | Dependencies |
|-------|------|----------|-----------------|--------------|
| **1** | Critical Fixes & Stability | URGENT | 1-2 days | None |
| **2** | Auth Hardening & UX Polish | HIGH | 3-4 days | Phase 1 |
| **3** | Real-Time Chat & Push Notifications | HIGH | 7-10 days | Phase 2 |
| **4** | Meetup Points & Map | HIGH | 5-7 days | Phase 2 |
| **5** | Trade System (Core Feature) | HIGH | 7-10 days | Phase 3, Phase 4 |
| **6** | Social Features & Profile Enhancements | MEDIUM | 4-5 days | Phase 3 |
| **7** | Code Quality & Tech Debt | LOW | 2-3 days | Any time |

---

## Phase 1 — Critical Fixes & Stability

> **Goal:** Fix data-loss bugs and crashes that affect current users immediately.

### BL-001 | Account deletion leaves orphaned Firestore data
- **Severity:** CRITICAL
- **File:** `src/screens/SettingScreen.tsx` (lines 170-178)
- **Problem:** `handleDeleteAccount` only deletes the `Users/{uid}` document and the Auth user. Firestore does NOT cascade-delete subcollections. Left behind:
  - `Users/{uid}/myBooks/*` — all books in inventory
  - `Users/{uid}/wishlist/*` — all wishlisted books
  - `bookOwners/{bookId}/owners/{uid}` — owner entries across every book
- **Impact:** Orphaned data grows forever. `getBookOwners` will crash when it tries to fetch a deleted user's profile for the owner list display.
- **Fix:** Before deleting the user doc, batch-delete all subcollection documents and all `bookOwners` entries referencing the user. Consider a Cloud Function for server-side cleanup.

### BL-002 | Genre list mismatch between onboarding and HomeScreen
- **Severity:** HIGH
- **Files:** `src/screens/PickAGenreScreen.tsx` (line 16-19) vs `src/screens/HomeScreen.tsx` (line 9)
- **Problem:** PickAGenreScreen offers **"Young Adult"** but HomeScreen does not display it. HomeScreen shows **"Recommended"** which PickAGenreScreen doesn't list.
- **Impact:** If a user picks "Young Adult" as their top preference, the "Recommended for you" row queries a term not in `GENRE_QUERY_MAP`, producing poor or empty results.
- **Fix:** Unify both genre arrays into a single shared constant. Add "Young Adult" to `GENRE_QUERY_MAP` in `bookService.ts`.

### BL-003 | No duplicate-add prevention for inventory & wishlist
- **Severity:** HIGH
- **File:** `src/services/userbookService.ts` (lines 23, 87)
- **Problem:** `addBookToUserInventory` and `addToWishlist` use `setDoc` with no existence check. Tapping "+ Own This" repeatedly silently overwrites the document and resets the `addedAt` timestamp.
- **Impact:** Confusing UX, corrupted timestamps.
- **Fix:** Check `getDoc` before writing. If exists, show "Already in your inventory" / "Already wishlisted" alert instead.

### BL-004 | Username update doesn't sync to Firebase Auth displayName
- **Severity:** HIGH
- **File:** `src/screens/SettingScreen.tsx` (lines 136-155)
- **Problem:** `handleUpdateProfile` updates `username` in Firestore but does NOT call `updateProfile(user, { displayName: newName })` on the Auth object. `App.tsx` reads `user.displayName` to decide onboarding vs main app.
- **Impact:** If `displayName` is ever cleared or nulled, the user gets stuck on the PickAGenre onboarding screen despite having a valid Firestore username.
- **Fix:** Add `updateProfile(getAuth().currentUser, { displayName: newName.trim() })` inside `handleUpdateProfile`.

### BL-005 | HomeScreen genre fetch — one failure kills all remaining genres
- **Severity:** HIGH
- **File:** `src/screens/HomeScreen.tsx` (lines 28-31)
- **Problem:** The `for...of` loop is wrapped in a single `try/catch`. If one genre API call fails, all subsequent genres return no data.
- **Impact:** A single network blip causes most of the home feed to show empty.
- **Fix:** Wrap each individual `fetchBooksByGenre` call in its own try/catch. Log the error and continue to the next genre.

### BL-006 | No loading state on Login button
- **Severity:** HIGH
- **File:** `src/screens/auth/LoginScreen.tsx` (lines 18-35)
- **Problem:** No `loading` state flag. The login button stays tappable during the Firebase auth call.
- **Impact:** Users can trigger multiple concurrent login requests by tapping repeatedly.
- **Fix:** Add `const [loading, setLoading] = useState(false)` and disable the button + show `ActivityIndicator` while loading.

---

## Phase 2 — Auth Hardening & UX Polish

> **Goal:** Strengthen authentication, add Google Sign-In, polish existing UX gaps.

### BL-007 | Google Sign-In (OAuth) for account creation and login
- **Severity:** HIGH (feature)
- **Files:** New `src/services/googleAuthService.ts`, modify `LoginScreen.tsx`, `RegisterScreen.tsx`
- **Problem:** Users can only sign up/log in with email + password. No social auth.
- **Requirements:**
  - Install `@react-native-google-signin/google-signin`
  - Configure OAuth client ID in Firebase Console → Authentication → Sign-in Providers → Google
  - Add Google Sign-In button to both Login and Register screens
  - On first Google sign-in, auto-create Firestore `Users/{uid}` doc with `email`, `username` (from Google display name), `photoURL` (from Google profile photo)
  - If user already has an email/password account with the same email, link the Google provider to the existing account
  - Handle the onboarding flow: if `displayName` is already set by Google, check if genres are selected; if not, route to PickAGenreScreen

### BL-008 | Forgot Password flow
- **Severity:** MEDIUM
- **File:** `src/screens/auth/LoginScreen.tsx`
- **Problem:** No password recovery path for email/password users.
- **Fix:** Add a "Forgot Password?" link below the login button. On tap, prompt for email, call `sendPasswordResetEmail(getAuth(), email)`, show success alert.

### BL-009 | Birthday validation is incomplete
- **Severity:** MEDIUM
- **File:** `src/screens/auth/RegisterScreen.tsx` (lines 48-63)
- **Problem:** Only validates month 1-12 and day 1-31. Does not check:
  - Year range (no future dates, no dates before 1900)
  - Impossible dates (Feb 30, Apr 31)
  - Minimum age requirement (e.g., 13+)
  - Stored as raw string, not a proper date
- **Fix:** Parse with `Date()`, validate the actual calendar date, enforce minimum age, store as ISO 8601 string.

### BL-010 | No "already owned" / "already wishlisted" indicator
- **Severity:** MEDIUM
- **File:** `src/screens/BookDetailScreen.tsx` (lines 101-117)
- **Problem:** "+ Own This" and "Wishlist" buttons always show the same state. User has no idea if they already added the book.
- **Fix:** On mount, check if `Users/{uid}/myBooks/{bookId}` and `Users/{uid}/wishlist/{bookId}` exist. If owned, show "Already Owned" (disabled/green). If wishlisted, show "Wishlisted" (disabled/heart icon).

### BL-011 | No pull-to-refresh on HomeScreen
- **Severity:** MEDIUM
- **File:** `src/screens/HomeScreen.tsx`
- **Problem:** Only way to refresh the home feed is to navigate away and back.
- **Fix:** Replace `ScrollView` with a `FlatList` (or add `RefreshControl` to `ScrollView`) and wire up a `onRefresh` callback that re-runs `loadAllData`.

### BL-012 | Hardcoded Cloudinary credentials
- **Severity:** MEDIUM
- **File:** `src/screens/SettingScreen.tsx` (lines 102-103)
- **Problem:** `cloudName` and `upload_preset` are hardcoded strings. The `@env` import is commented out.
- **Fix:** Add `CLOUDINARY_CLOUD_NAME` and `CLOUDINARY_UPLOAD_PRESET` to `.env`. Import from `@env` and replace the hardcoded values.

### BL-013 | Normalize book data shape across the app
- **Severity:** MEDIUM
- **File:** `src/services/bookService.ts`
- **Problem:** `searchBooks` returns flat objects `{id, title, authors, thumbnail}` while `fetchBooksByGenre` returns raw Google Books API items with nested `volumeInfo`. Multiple components handle both shapes with fragile fallbacks.
- **Fix:** Create a single `normalizeBook(rawItem)` function that always returns a consistent `Book` interface. Apply it in both `fetchBooksByGenre` and `searchBooks`.

---

## Phase 3 — Real-Time Chat & Push Notifications

> **Goal:** Enable encrypted real-time messaging between users and push notifications via Firebase Cloud Messaging (FCM).

### BL-014 | Firebase Cloud Messaging (FCM) — Push Notifications
- **Severity:** HIGH (feature)
- **Files:** New `src/services/notificationService.ts`, modify `App.tsx`
- **Requirements:**
  - Install `@react-native-firebase/messaging`
  - Request notification permissions on app launch (`messaging().requestPermission()`)
  - On permission grant, retrieve FCM device token (`messaging().getToken()`)
  - Store token in Firestore: `Users/{uid}/fcmTokens/{deviceId}`
  - Listen for token refresh (`messaging().onTokenRefresh()`) and update Firestore
  - Handle foreground notifications (`messaging().onMessage()`) — display in-app banner
  - Handle background/quit notifications (`messaging().setBackgroundMessageHandler()`)
  - Notification types to support:
    - `trade_request` — someone wants to trade with you
    - `trade_accepted` / `trade_declined` — trade response
    - `new_message` — new chat message
    - `book_available` — a wishlisted book is now available nearby
  - Server-side: Use Firebase Cloud Functions or a backend to send targeted notifications via FCM Admin SDK

### BL-015 | Real-Time Encrypted Chat System
- **Severity:** HIGH (feature)
- **Files:** New screen `src/screens/ChatScreen.tsx`, `src/screens/ChatListScreen.tsx`, new service `src/services/chatService.ts`, new `src/utils/encryption.ts`
- **Architecture:**

  **Firestore Schema:**
  ```
  Chats/{chatId}
    ├── participants: [uid1, uid2]
    ├── lastMessage: (encrypted string)
    ├── lastMessageAt: (timestamp)
    ├── createdAt: (timestamp)
    └── Messages/{messageId}
          ├── senderId: uid
          ├── ciphertext: (encrypted message body)
          ├── iv: (initialization vector, base64)
          ├── sentAt: (timestamp)
          └── readAt: (timestamp | null)
  ```

  **End-to-End Encryption (E2EE):**
  - Use `react-native-quick-crypto` (or `expo-crypto` if using Expo) for AES-256-GCM encryption
  - **Key Exchange:** On first conversation, generate a shared secret using Diffie-Hellman key exchange:
    - Each user generates an ECDH key pair on registration, stores the public key in Firestore `Users/{uid}/publicKey`
    - Private key stored locally in device Keychain/Keystore via `react-native-keychain`
    - Shared secret derived from `ECDH(myPrivateKey, theirPublicKey)`
  - **Message Encryption (Stateless):**
    - Each message generates a fresh random IV (initialization vector)
    - Encrypt: `AES-256-GCM(sharedSecret, iv, plaintext)` → store `{ciphertext, iv}` in Firestore
    - Decrypt: `AES-256-GCM(sharedSecret, iv, ciphertext)` → plaintext on receiver's device
    - No session state stored server-side — every message is independently decryptable with the shared secret + IV
    - Server (Firestore) never sees plaintext — only encrypted blobs
  - **Key Rotation:** Rotate shared secret every 30 days or on user request

  **Real-Time Sync:**
  - Use `onSnapshot` on `Chats/{chatId}/Messages` collection, ordered by `sentAt`
  - Messages decrypted client-side before display
  - Typing indicators via `Chats/{chatId}/typing/{uid}` (ephemeral doc, TTL 5s)

  **Chat UI:**
  - `ChatListScreen`: List of active conversations, sorted by `lastMessageAt`, showing decrypted preview
  - `ChatScreen`: Message bubbles (sender right, receiver left), text input, send button, timestamps
  - Add "Chat" tab to TabNavigator or accessible from ProfileScreen / BookDetailScreen

  **Security Considerations:**
  - Messages are encrypted at rest in Firestore (E2EE ciphertext) and in transit (Firestore TLS)
  - Private keys never leave the device
  - No plaintext stored on server — even Firebase admins cannot read messages
  - On account deletion, delete all `Chats` where user is a participant
  - Rate-limit message sends to prevent spam

### BL-016 | Chat entry points across the app
- **Severity:** MEDIUM
- **Files:** `BookDetailScreen.tsx`, `ProfileScreen.tsx`
- **Requirements:**
  - On `BookDetailScreen` owner cards: Add a "Message" button next to each owner
  - On `ProfileScreen` (viewing another user): Add "Send Message" button
  - Both entry points create or navigate to an existing `Chats/{chatId}` between the two users

---

## Phase 4 — Meetup Points & Map

> **Goal:** Let readers pick up to 3 public meetup places and see on a map where books are available — without TaleTrade ever storing or showing anyone's location. The map shows **curated public places** (malls, campus libraries, bookstores, cafés), not people.
>
> This replaces the earlier location-sharing design for BL-017/018/019. Removed from scope: storing user locations in Firestore (`Users/{uid}/location`), geohash / GeoFirestore queries, the location-sharing opt-in toggle, the 7-day location expiry, and `react-native-geolocation-service`.

### BL-017 | Meetup points and MapLibre map (MapTiler tiles)
- **Severity:** HIGH (feature)
- **Status:** DONE (code implemented; the manual steps in README → "Meetup points setup" must be done once per Firebase project)
- **Files:** `src/screens/map/MapScreen.tsx`, `src/services/map/meetupService.ts`, `src/screens/SettingScreen.tsx`, `src/services/userbookService.ts`, `src/types/index.ts`, `firestore.rules`, `data/meetupSpots.json`, `scripts/seedMeetupSpots.js`
- **What exists:**

  **Data model**
  - `meetupSpots/{spotId}` — curated, read-only from the app: `name`, `type` (`mall` | `library` | `bookstore` | `cafe` | `campus` | `other`), `lat`, `lng`, `address`, `city`, `openHours`, `safetyNote` (optional), `active`. Seeded with `scripts/seedMeetupSpots.js` (Admin SDK; refuses entries with null coordinates).
  - `Users/{uid}.preferredSpots` — up to 3 spot ids.
  - `bookOwners/{bookId}/owners/{uid}` is denormalized with `bookId`, `title`, `author`, `thumbnail`, `spotIds` (a copy of the owner's `preferredSpots`), alongside the existing `userId` and `addedAt`.

  **Settings**
  - "Where I can meet" card: multi-select of active spots, maximum 3, with a visible message when the limit is hit.
  - `setPreferredSpots(uid, spotIds)` saves `preferredSpots` and rewrites `spotIds` plus the denormalized fields on every existing owner doc built from the user's `myBooks` (batches of 400), which also backfills older owner docs.
  - `addBookToUserInventory` reads the user's `preferredSpots` and writes the extra owner-doc fields.

  **Map**
  - `@maplibre/maplibre-react-native` (v11, new architecture) with MapTiler tiles: `https://api.maptiler.com/maps/streets-v2/style.json?key={MAPTILER_API_KEY}`; the key comes from `@env` (declared in `env.d.ts`).
  - One marker per active spot with a badge showing how many books are available there; tapping a marker opens the spot sheet (BL-018).
  - Loading, empty and error states (the error state has a retry button and also appears when `MAPTILER_API_KEY` is missing).

  **Firestore rules** (`firestore.rules`, deployed manually)
  - `meetupSpots`: read for signed-in users, no client writes.
  - Owner docs: update allowed for the owner (with `userId` unchanged); `spotIds`, when present, must be a list of at most 3.
  - Read-only collection-group rule for `owners`.
  - `Users/{uid}/myBooks/{id}` is readable by signed-in users, so other users' profiles can show their book count.

- **Known limits:** book counts and per-spot book lists are computed in the app from owner docs (one read per owner/book pair at a spot); there is no marker clustering.

### BL-018 | Spot sheet, wishlist highlights and "center on me"
- **Severity:** MEDIUM
- **Status:** PARTIAL (core flow done; items under "Not implemented" remain)
- **Files:** `src/component/map/SpotSheet.tsx`, `src/component/map/SpotList.tsx`, `src/screens/map/MapScreen.tsx`, `src/screens/BookDetailScreen.tsx`, `src/services/map/meetupService.ts`, `src/services/map/locationService.ts`
- **Implemented:**

  **Spot sheet**
  - "Books" first, then a collapsible "Spot info" (address, opening hours, safety note).
  - One row per book (results grouped by `bookId`): thumbnail, title, author, owner count. Expanding a row lists its owners; tapping an owner opens `UserProfileView`, tapping the row opens `BookDetail`.
  - Books on the viewer's wishlist sort to the top with a "★ On your wishlist" badge (the viewer's own copies don't count).
  - 20 books shown first with "Show more"; pagination is client-side because owner counts and wishlist ordering need all of a spot's rows.
  - Search box (title/author) only when the spot has more than 10 distinct books.
  - Loading, error with retry, and the empty state "No books here yet. Add this spot in Settings to list yours."

  **Integration**
  - BookDetail shows each owner's meetup spot names and a "View on map" button that opens the Map tab filtered to the spots that have the book.
  - Spots with a book from the viewer's wishlist get a gold star marker and a legend on the map.

  **Center on me (on-device only)**
  - Foreground permission is requested once when the Map tab first opens; the map centers on the user with a blue dot, and a "locate me" button re-centers.
  - Distances ("850 m", "1.2 km") appear in the spot sheet and in a spot list with a "Nearest first" toggle.
  - The position is read once (last known device position) and kept in component state only: never written to Firestore, AsyncStorage or logs. No background location.
  - If permission is denied or no position is available, the map keeps its default view and hides distances; if the user chose "never ask again", an alert offers `Linking.openSettings()`.

- **Not implemented:**
  - Filtering the map by arbitrary book/genre from a search bar (only the BookDetail "View on map" filter exists).
  - A "books near me" list of individual books (the spot list shows spots, not books).
  - Push notification when a wishlisted book becomes available at a spot (depends on BL-014).

### BL-019 | Add Map tab to navigation
- **Severity:** MEDIUM
- **Status:** DONE
- **Files:** `src/navigation/TabNavigator.tsx`, `src/component/TabBar.tsx`
- **What exists:**
  - "Map" is the 6th tab, between Wishlist and Profile, with the `MapPin` icon from `lucide-react-native`.
  - Tab horizontal padding in `TabBar` was reduced from 12 to 8 so five icons plus one labelled tab fit; checked on the Pixel 7 (API 35) emulator.

---

## Phase 5 — Trade System (Core Feature)

> **Goal:** Implement the actual book trading flow — the core value proposition of TaleTrade.

### BL-020 | Trade request & response flow
- **Severity:** HIGH (feature)
- **Files:** New `src/screens/TradeScreen.tsx`, `src/screens/TradeDetailScreen.tsx`, new `src/services/tradeService.ts`
- **Requirements:**

  **Firestore Schema:**
  ```
  Trades/{tradeId}
    ├── requesterId: uid
    ├── ownerId: uid
    ├── bookOffered: { bookId, title, thumbnail }
    ├── bookRequested: { bookId, title, thumbnail }
    ├── status: 'pending' | 'accepted' | 'declined' | 'completed' | 'cancelled'
    ├── createdAt: (timestamp)
    ├── updatedAt: (timestamp)
    └── chatId: (reference to Chats/{chatId} for this trade)
  ```

  **Trade Flow:**
  1. User A sees User B owns a book they want (from BookDetailScreen owner list or Map)
  2. User A taps "Request Trade" → selects a book from their own inventory to offer
  3. Trade request created in Firestore, push notification sent to User B (BL-014)
  4. User B sees pending trade request → Accept / Decline / Counter-offer
  5. On accept, both users are connected via chat (BL-015) to arrange meetup
  6. Both users confirm trade completion → books swap in Firestore inventories
  7. Trade marked as `completed`

  **Trade Entry Points:**
  - BookDetailScreen → "Request Trade" button (alongside "Own This" and "Wishlist")
  - ProfileScreen (viewing another user) → "Propose Trade" button
  - Map marker bottom sheet → "Trade" button

### BL-021 | Book availability status
- **Severity:** MEDIUM
- **File:** `src/services/userbookService.ts`
- **Requirements:**
  - Add `tradeStatus` field to inventory books: `'available' | 'not_trading' | 'in_trade'`
  - Users can toggle availability in MyBooksScreen
  - Only books with `tradeStatus: 'available'` show in search results and map markers for other users
  - Default new books to `'available'`

### BL-022 | Trade history screen
- **Severity:** LOW
- **Requirements:**
  - View past trades (completed, declined, cancelled)
  - Trade rating/review system (optional, post-trade feedback)

---

## Phase 6 — Social Features & Profile Enhancements

> **Goal:** Enrich the social layer — friend system, multiple social links, deep-link redirection.

### BL-023 | Add User / Friend system
- **Severity:** MEDIUM
- **Files:** New `src/services/friendService.ts`, modify `ProfileScreen.tsx`, new `src/screens/FriendsListScreen.tsx`
- **Requirements:**

  **Firestore Schema:**
  ```
  Users/{uid}/friends/{friendUid}
    ├── status: 'pending' | 'accepted' | 'blocked'
    ├── sentBy: uid (who initiated)
    ├── createdAt: (timestamp)
  ```

  **Features:**
  - "Add Friend" button on other users' ProfileScreen
  - Friend request notification via FCM (BL-014)
  - Accept / Decline friend requests
  - Friends list screen accessible from ProfileScreen
  - Friends get priority in search results and map markers
  - Block user functionality (blocked users can't send trade requests or messages)

### BL-024 | Multiple social links with deep-link redirection
- **Severity:** MEDIUM
- **Files:** Modify `src/screens/SettingScreen.tsx`, `src/screens/ProfileScreen.tsx`, modify `src/services/userService.ts`
- **Problem:** Currently only one `socialLink` field as a raw URL string. No platform detection, no deep linking.
- **Requirements:**

  **Firestore Schema Update:**
  ```
  Users/{uid}/socialLinks: [
    { platform: 'facebook', url: 'https://facebook.com/username' },
    { platform: 'instagram', url: 'https://instagram.com/username' },
    { platform: 'twitter', url: 'https://x.com/username' },
    { platform: 'tiktok', url: 'https://tiktok.com/@username' },
    { platform: 'custom', url: 'https://mysite.com', label: 'Blog' }
  ]
  ```

  **Settings Screen:**
  - Replace single "Contact Link" input with a dynamic list
  - "Add Link" button → platform picker (Facebook, Instagram, Twitter/X, TikTok, Custom)
  - Input field for URL/username per platform
  - Auto-detect platform from URL (e.g., if URL contains "instagram.com", set platform to Instagram)
  - Reorder / delete links

  **Profile Screen:**
  - Display social links as platform-specific icons (FB icon, IG icon, etc.)
  - On tap, use deep-link redirection:
    - **Facebook:** Try `fb://profile/{id}` → fallback to `https://facebook.com/...`
    - **Instagram:** Try `instagram://user?username={name}` → fallback to `https://instagram.com/...`
    - **Twitter/X:** Try `twitter://user?screen_name={name}` → fallback to `https://x.com/...`
    - **TikTok:** Try `snssdk1233://user/profile/{name}` → fallback to `https://tiktok.com/@...`
    - **Custom:** Open in browser via `Linking.openURL()`
  - Use `Linking.canOpenURL()` to check if native app is installed before attempting deep link

### BL-025 | User search and discovery
- **Severity:** MEDIUM
- **Files:** Modify `src/screens/SearchScreen.tsx`
- **Requirements:**
  - Add a tab/toggle on SearchScreen: "Books" | "Users"
  - Users tab: search by username, show avatar + username + book count
  - Tap a user → navigate to their ProfileScreen

---

## Phase 7 — Code Quality & Tech Debt

> **Goal:** Clean up dead code, improve type safety, and reduce bundle size.

### BL-026 | Dead code: `MainNavigator` in TabNavigator.tsx
- **Severity:** LOW
- **File:** `src/navigation/TabNavigator.tsx` (lines 26-46)
- **Problem:** Named export `MainNavigator` with its own stack navigator is never imported anywhere. Dead code.
- **Fix:** Remove the entire `MainNavigator` component and its associated `RootStackParamList` type.

### BL-027 | Dead code: Empty `DrawerNavigator.tsx`
- **Severity:** LOW
- **File:** `src/navigation/DrawerNavigator.tsx`
- **Fix:** Delete the file.

### BL-028 | Dead code: Web Firebase SDK (`firebaseConfig.ts` + `private.ts`)
- **Severity:** LOW
- **Files:** `src/api/firebaseConfig.ts`, `src/api/private.ts`
- **Problem:** Initialize `firebase/app`, `firebase/firestore`, `firebase/auth` (WEB SDK) but the entire app uses `@react-native-firebase/*`. Adds unused dependencies to the bundle.
- **Fix:** Delete both files. Remove `firebase` web SDK from `package.json` if it's only used here.

### BL-029 | Stale AsyncStorage reference
- **Severity:** LOW
- **File:** `src/screens/SettingScreen.tsx` (line 173)
- **Problem:** `AsyncStorage.removeItem('user_profile_image')` references a key that nothing in the codebase writes to.
- **Fix:** Remove the line. If AsyncStorage import becomes unused, remove that too.

### BL-030 | Replace `any` types with proper TypeScript interfaces
- **Severity:** LOW
- **Files:** All screens and services
- **Problem:** Almost every prop, state, and data object uses `any`. The `Book` interface in `types/index.ts` exists but is barely used.
- **Fix:**
  - Expand `types/index.ts` with interfaces for `User`, `Book`, `Trade`, `ChatMessage`, `Owner`, etc.
  - Replace `any` with proper types across all files
  - Type navigation props using React Navigation's typed hooks

### BL-031 | CHANGELOG.md accuracy
- **Severity:** LOW
- **File:** `CHANGELOG.md`
- **Problem:** ~~Table row for App.tsx said migration target was `onUserChanged` but actual fix was `onIdTokenChanged`.~~ Fixed on 2026-10-27.
- **Status:** DONE

---

## Ticket Reference Table

| Ticket | Title | Phase | Severity | Status |
|--------|-------|-------|----------|--------|
| BL-001 | Account deletion orphaned data | 1 | CRITICAL | TODO |
| BL-002 | Genre list mismatch | 1 | HIGH | TODO |
| BL-003 | Duplicate-add prevention | 1 | HIGH | TODO |
| BL-004 | Username ↔ displayName sync | 1 | HIGH | TODO |
| BL-005 | Per-genre error isolation | 1 | HIGH | TODO |
| BL-006 | Login loading state | 1 | HIGH | TODO |
| BL-007 | Google Sign-In (OAuth) | 2 | HIGH | TODO |
| BL-008 | Forgot Password flow | 2 | MEDIUM | TODO |
| BL-009 | Birthday validation | 2 | MEDIUM | TODO |
| BL-010 | Already owned/wishlisted indicator | 2 | MEDIUM | TODO |
| BL-011 | Pull-to-refresh HomeScreen | 2 | MEDIUM | TODO |
| BL-012 | Hardcoded Cloudinary creds | 2 | MEDIUM | TODO |
| BL-013 | Normalize book data shape | 2 | MEDIUM | TODO |
| BL-014 | FCM Push Notifications | 3 | HIGH | TODO |
| BL-015 | Real-Time Encrypted Chat | 3 | HIGH | TODO |
| BL-016 | Chat entry points | 3 | MEDIUM | TODO |
| BL-017 | Meetup points + MapLibre map (MapTiler) | 4 | HIGH | DONE |
| BL-018 | Spot sheet, wishlist highlights, center on me | 4 | MEDIUM | PARTIAL |
| BL-019 | Map tab in navigation | 4 | MEDIUM | DONE |
| BL-020 | Trade request & response flow | 5 | HIGH | TODO |
| BL-021 | Book availability status | 5 | MEDIUM | TODO |
| BL-022 | Trade history | 5 | LOW | TODO |
| BL-023 | Add User / Friend system | 6 | MEDIUM | TODO |
| BL-024 | Social links deep-link redirection | 6 | MEDIUM | TODO |
| BL-025 | User search and discovery | 6 | MEDIUM | TODO |
| BL-026 | Dead code: MainNavigator | 7 | LOW | TODO |
| BL-027 | Dead code: DrawerNavigator | 7 | LOW | TODO |
| BL-028 | Dead code: Web Firebase SDK | 7 | LOW | TODO |
| BL-029 | Stale AsyncStorage reference | 7 | LOW | TODO |
| BL-030 | Replace `any` types | 7 | LOW | TODO |
| BL-031 | CHANGELOG accuracy | 7 | LOW | DONE |

---

**Total: 31 tickets** | 1 Critical, 10 High, 14 Medium, 6 Low
