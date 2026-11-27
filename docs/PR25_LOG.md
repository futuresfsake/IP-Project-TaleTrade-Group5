# PR #25 log

"Feed, TaleTrade's own API, and a UI refresh" (`feat/feed-page` → `test`)

Date: 2026-11-27. Author of the PR: `maykaila`. Review, fixes and merge: `futuresfsake`.

## 1. Review of `878a894`

Result: changes needed. Three problems to fix before merging:

1. Deleting an account left its listings behind.
2. The app and server matched editions differently for titles with curly apostrophes or dashes.
3. Readers on one network shared a rate limit of 120 requests a minute.

## 2. Tests on `878a894`, before the fixes

| Check | Result |
|---|---|
| `npm test` | 78/78 passing |
| JavaScript release bundle | Built |
| Android debug build (x86_64 only) | Built |
| Demo API | `/health` worked; missing and fake tokens were rejected |
| Pixel 8 emulator: Home, Feed, Library, Book Detail, Profile | Loaded; the app did not crash |
| Map | Not tested: the local `.env` had no `MAPTILER_API_KEY` |

The emulator hung once after Google Play services crashed and worked after a cold boot. The Feed
used demo data; nothing was saved in the app.

## 3. Fixes (`fb09155`)

All three problems were fixed. See [PR25_FIXES.md](PR25_FIXES.md).

## 4. Checks after the fixes

| Check | Result |
|---|---|
| `npm test` | 86/86 passing |
| ESLint | 0 errors, 6 warnings |
| `tsc --noEmit` | Only the earlier errors in the unused `src/api/firebaseConfig.ts` |
| Secret scan of the changes (gitleaks) | No leaks found |
| `npm audit --omit=dev`, `server/` | 0 vulnerabilities |
| `npm audit --omit=dev`, app | 24 found during review (2 critical, 11 high); not changed by this PR |
| Semgrep | Not run (not installed) |
| App bundle matching rule | Agrees with the server for every character Node's Unicode 16 defines |

The fixes were not re-tested on an emulator or against real Firestore.

## 5. Merge

Squash merge into `test` through PR #25.

## Follow-ups

- [ ] Delete a throwaway account with a visible and a hidden listing, with the API running and again
      with it stopped.
- [ ] Deploy the API over HTTPS; the Feed and account deletion need it.
- [ ] Add `MAPTILER_API_KEY` and `TALETRADE_API_URL` to each developer's `.env`, then test the Map.
- [ ] Update app dependencies to clear the `npm audit` findings.
- [ ] Cache or page `GET /v1/availability`, which reads every library on each call.
- [ ] Make "Wishlist matches" include other editions.
- [ ] Decide whether other readers should see a user's whole library.
- [ ] Let the edit sheet change condition, exchange type and note.
