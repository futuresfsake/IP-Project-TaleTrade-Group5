# TaleTrade API

TaleTrade's **own REST API** (Node + Express + Firebase Admin). It serves book details, meetup
locations and the community **Feed**, and is the only thing allowed to write the `listings`
collection. The mobile app calls it with the signed-in user's Firebase ID token.

## Why an API of our own?

Before this API the app talked straight to Google Books (with the key shipped inside the APK) and
read Firestore directly. That meets "uses an API" but not "has its own API". The design below
makes TaleTrade's API the product surface and treats Google Books as just one upstream data source.

| Requirement / weakness | What the API does |
|------------------------|-------------------|
| Own API for **book details** | `GET /v1/books/:id` returns TaleTrade's normalised `Book` (not Google's raw `volumeInfo`) **plus our own data**: how many readers own it, how many listings are available, and the meetup spots where it can be picked up. |
| Own API for **location** | `GET /v1/spots` and `GET /v1/spots/:id` serve our curated meetup spots with server-computed distance (`lat`/`lng` in, `distanceKm` out) and live listing counts, so it is *our* geodata and logic, not MapTiler's. (MapTiler remains only the tile renderer on the Map tab.) |
| Third-party key in the APK | The Google Books key lives only on the server. The Feed never needs it on the device. |
| Third-party outage / quota | Book lookups are cached (10 min TTL) and fall back to the title/author/thumbnail we already store in `bookOwners`, so details still render when Google is down. Only a book we have never seen returns `502`. |
| Business rules in the client | Rules live server-side and are enforced for everyone: you can only list a book that is in *your* library, max 3 spots, spots must be real and active, valid statuses/conditions, 280-char notes, one listing per user per book. Firestore rules forbid client writes to `listings`. |
| Consistency with existing features | Listings are tied to `Users/{uid}/myBooks`. Removing a book (or deleting the account) hides its listing immediately: the API drops listings whose book left the library and cleans them up lazily. |
| Abuse / cost | Per-IP and per-user rate limiting, 10 KB body limit, strict input validation, consistent JSON errors. |

### Suggested next steps (not implemented)

1. Move Home/Search/Genre calls (`bookService.ts`) behind `GET /v1/books/search` so *every* book
   lookup uses our API and the Google key can be removed from the app entirely.
2. Persist a `bookCache` collection so cache survives restarts and multiple instances.
3. Replace the in-memory rate limiter with a shared store (Redis) if the API is scaled out.
4. Add a push-notification hook (FCM, see `BACKLOG.md`) when a listing becomes `reserved`.
5. Publish an OpenAPI file generated from the validators.

## Run it

```powershell
cd server
npm install
$env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\path\to\serviceAccount.json'   # outside the repo
$env:GOOGLE_BOOKS_API_KEY = 'your_key'
npm start                                                                  # http://localhost:3000
```

Android emulator: the app reaches your PC at `http://10.0.2.2:3000`, so put this in the app's
root `.env` and restart Metro with `--reset-cache`:

```
TALETRADE_API_URL=http://10.0.2.2:3000
```

Physical device: use your PC's LAN IP, or `adb reverse tcp:3000 tcp:3000` and `http://localhost:3000`.
Release builds block cleartext HTTP, so deploy the API behind HTTPS (e.g. Cloud Run, Render) and use
that URL for release APKs.

Tests (no Firebase or network needed — an in-memory store is injected):

```powershell
npm test   # from the repository root; the server suite lives in server/__tests__
```

## Conventions

- Base path `/v1`. Everything except `GET /health` needs `Authorization: Bearer <Firebase ID token>`.
- Errors are always `{ "error": { "code": "snake_case", "message": "…" } }`.
- Timestamps are epoch milliseconds. Distances are kilometres (`distanceKm`), only present when
  `lat` and `lng` are sent (both or neither; otherwise `400`).
- Listing ids are `{ownerUid}_{bookId}`, so a user has at most one listing per book.

## Endpoints

### Locations

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/spots?lat&lng&type` | Active meetup spots with `listingCount` (available listings) and `distanceKm`; nearest first when coordinates are sent, otherwise A–Z. `type`: `mall`, `library`, `bookstore`, `cafe`, `campus`, `other`. |
| `GET` | `/v1/spots/:id?lat&lng` | One spot plus the visible listings available there (`spot`, `listingCount`, `listings[]`). `404 spot_not_found`. |

### Books

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/books/:id?lat&lng` | `{ book, community: { ownerCount, listingCount, availableCount }, availableAt: [spot + listingCount], myListing }`. `book.source` is `google-books` or `taletrade` (fallback). `404 book_not_found`, `502 book_provider_unavailable`. |

### Feed and listings

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/feed?filter&lat&lng&radiusKm&limit&cursor` | Visible (available/reserved) listings, newest first. Your own are included and flagged `isMine`. `filter`: `all` (default), `available`, `nearby` (needs coordinates; `radiusKm` 1–50, default 10), `wishlist` (other readers' listings of books on your wishlist). `limit` 1–50 (default 20). Returns `{ items, nextCursor }`; pass `nextCursor` back as `cursor`. |
| `GET` | `/v1/me/listings` | Your listings (all statuses) and `summary { listed, available, reserved }`. |
| `GET` | `/v1/me/books` | Your library, each book with `listing: { id, status } \| null` (powers the "List a book" picker). |
| `POST` | `/v1/listings` | Create. Body: `bookId`, `condition` (`like_new`/`good`/`fair`/`well_loved`), `exchange[]` (`trade`/`lend`/`give_away`), `spotIds[]` (1–3), optional `availableTimes` (≤ 80), `note` (≤ 280), `status`. `201` with the feed item. Errors: `400`, `404 book_not_in_library`, `409 listing_exists`. |
| `PATCH` | `/v1/listings/:id` | Owner only. Any subset of the create fields except `bookId`; `403` for other users. |
| `DELETE` | `/v1/listings/:id` | Owner only; idempotent for your own ids. `204`. |

A **feed item**:

```json
{
  "id": "uid_dune", "status": "available", "condition": "good", "exchange": ["trade", "lend"],
  "availableTimes": "Weekends", "note": "", "createdAt": 1764000000000, "updatedAt": 1764000000000,
  "isMine": false, "wishlisted": true,
  "owner": { "id": "uid", "username": "Maria", "photoURL": null },
  "book": { "id": "dune", "title": "Dune", "author": "Frank Herbert", "authors": ["Frank Herbert"], "thumbnail": "https://…" },
  "spots": [{ "id": "ayala-center-cebu", "name": "Ayala Center Cebu", "type": "mall", "distanceKm": 1.2, "…": "…" }],
  "nearestDistanceKm": 1.2
}
```

Hidden (`unavailable`) listings never appear in the community feed but stay in `/v1/me/listings`.

## Data

`listings/{ownerUid}_{bookId}`: `ownerId`, `bookId`, `title`, `author`, `thumbnail` (denormalised from
`myBooks`), `status`, `condition`, `exchange[]`, `spotIds[]`, `availableTimes`, `note`, `createdAt`,
`updatedAt`. Only this API writes it (Admin SDK; clients have no rule that allows `listings`).

The feed query orders by `updatedAt` only, so it needs **no composite Firestore index**.

## Layout

```
server/
├── src/
│   ├── index.js              # production entry (Firebase Admin, Google Books, Firestore)
│   ├── app.js                # Express app factory (all dependencies injected)
│   ├── service.js            # business logic (feed, listings, spots, books)
│   ├── validation.js         # request validation
│   ├── auth.js, rateLimit.js, errors.js, geo.js
│   ├── bookProvider.js       # Google Books -> TaleTrade Book, with cache
│   └── store/                # firestoreStore.js (prod) and memoryStore.js (tests)
└── __tests__/api.test.js
```
