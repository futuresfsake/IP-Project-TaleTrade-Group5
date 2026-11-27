# PR #25 review fixes

Three problems found while reviewing "Feed, TaleTrade's own API, and a UI refresh", and how each
one was fixed.

## 1. Deleting an account left its listings behind

**Problem.** The app deleted the user's library, wishlist and profile, but not their documents in
`listings` (only the API may write that collection). Notes and pinned locations stayed stored, and
the listing counts on meetup spots and Book Detail still included them.

**Fix.**
- New endpoint `DELETE /v1/me/listings` removes all of the caller's listings, hidden ones included.
- Delete account calls it first, while the sign-in token is still valid.
- `GET /v1/spots` and `GET /v1/books/:id` now drop listings whose book left the owner's library, so
  counts are correct and leftovers are cleaned up.
- Listing deletion is split into batches, because Firestore accepts at most 500 writes per batch.

**Behaviour change.** If the app has an API address and the call fails, account deletion stops with
a message and nothing is deleted. The API therefore has to be running to delete an account. An app
with no `TALETRADE_API_URL` skips this step.

**Not covered.** Hidden listings left by accounts deleted before this fix are only removed when a
Book Detail request for that book reads them.

Files: `server/src/app.js`, `server/src/service.js`, `server/src/store/firestoreStore.js`,
`src/services/feedService.ts`, `src/screens/SettingScreen.tsx`

## 2. Some editions did not match

**Problem.** The app and the server build a "title + first author" key to match editions. The app
kept punctuation such as curly apostrophes and long dashes, while the server removed it. Books like
"Harry Potter and the Philosopher’s Stone" could show no owners nearby for another edition.

**Fix.** The app now uses the same rule as the server (keep letters and numbers only).

Files: `src/services/nearbyService.ts`

## 3. Readers on one network shared a rate limit

**Problem.** The check that runs before sign-in allowed 120 requests a minute per IP address, the
same as the per-user limit. A few people on campus Wi-Fi, or every user behind a hosting proxy,
could block each other.

**Fix.**
- The per-address limit is now 1200 a minute. The per-user limit stays at 120.
- New server setting `TRUST_PROXY`: the number of reverse proxies in front of the API, so each
  reader's own address is used. Leave it unset when the server is reached directly, otherwise
  clients could fake their address.

Files: `server/src/app.js`, `server/src/index.js`, `server/.env.example`

## Testing

- `npm test`: 86 passing, including 8 new tests for the three fixes.
- ESLint: no errors.
- `tsc --noEmit`: only the earlier errors in the unused `src/api/firebaseConfig.ts`.
- The app bundle builds, and its compiled matching rule agrees with the server's for every character
  that Node's Unicode 16 defines.

Still to check by hand: delete a throwaway account that has a visible and a hidden listing, with the
API running and again with it stopped.

## Raised in review, not changed

- `GET /v1/availability` reads every library on each call.
- The Feed's "Wishlist matches" filter matches one edition only.
- `/v1/availability` shows each reader's library to other signed-in readers.
- The edit sheet cannot change condition, exchange type or note.
