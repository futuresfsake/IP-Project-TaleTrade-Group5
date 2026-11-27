# TaleTrade test cases (PR #25, in `test`)

Please run the cases marked **Not run** and fill in the Result column. Allow about an hour.
Start with Part A.

## Status on 2026-11-27 (commit `53c8a05`)

| Check | Result |
|---|---|
| `npm test` | 86/86 passing |
| ESLint | 0 errors, 6 warnings |
| Type check | Only old errors in the unused `src/api/firebaseConfig.ts` |
| Android debug build (x86_64) | Built |
| Pixel 8 emulator smoke test, demo API | Cases marked **Pass (demo)** below; no app errors logged |

**Pass (demo)** means it worked on an emulator against made-up data. It still needs checking with
the real API.

## Setup

You need an Android phone or emulator and Node 22.11 or newer.

1. Get the code and packages:
   ```powershell
   git checkout test
   git pull
   npm install --legacy-peer-deps
   cd server; npm install; cd ..
   ```
2. In the root `.env` (never commit it):
   ```
   GOOGLE_BOOKS_API_KEY=...
   MAPTILER_API_KEY=...
   TALETRADE_API_URL=http://10.0.2.2:3000
   ```
   On a real phone use `http://localhost:3000` instead.
3. Put `google-services.json` in `android/app/`.
4. Start the API in its own terminal. It needs a Firebase service-account key, kept outside the repo.
   Ask a team member for it privately.
   ```powershell
   cd server
   $env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\path\to\serviceAccount.json'
   $env:GOOGLE_BOOKS_API_KEY = 'your_key'
   $env:MAPTILER_API_KEY = 'your_key'
   npm start
   ```
   Do not use `npm run demo` for this: it uses fake data, so the deletion cases would prove nothing.
5. Start the app in two more terminals:
   ```powershell
   npx react-native start --reset-cache
   npx react-native run-android
   ```
   On a real phone also run `adb reverse tcp:8081 tcp:8081` and `adb reverse tcp:3000 tcp:3000`.

**This writes to the real database.** Use new test accounts only (A, B and C below), never delete a
real account, and clean up afterwards. Meetup spots must already exist in Firestore.

## Part A: review fixes (most important)

| ID | Test case | Steps | Expected result | Result |
|---|---|---|---|---|
| TC-01 | Deleting an account removes its posts | A adds two books, picks meetup spots, lists both and hides one. B notes the map pin count. A logs out, logs in, then Settings → Delete account | Account is deleted. B no longer sees A's post and the pin count drops | Not run |
| TC-02 | Hidden posts are deleted too | After TC-01, open `listings` in the Firestore console | No document starts with A's user ID | Not run |
| TC-03 | Deletion stops when the API is off | C lists a book, logs out and in. Stop the API. Delete account | "Could not delete account". C stays signed in; books and profile are intact | Not run |
| TC-04 | Deletion works after the API returns | Start the API again. C deletes the account | Account and its post are removed | Not run |
| TC-05 | Another edition still matches | A picks a spot and adds a book with an apostrophe in its title. B picks the same spot and opens a different edition nobody added | A appears as an owner, with "1 owner nearby" or more | Not run |
| TC-06 | Shared network is not blocked | A and B browse quickly on the same network for two minutes | Neither sees "Too many requests" | Not run |

## Part B: general checks

### Sign-in and Home

| ID | Test case | Steps | Expected result | Result |
|---|---|---|---|---|
| TC-07 | Register | Create an account and pick genres | Continue needs 3 genres, then Home opens | Not run |
| TC-08 | Home | Open the app signed in | Greeting with your name, book rows and tab bar | Pass (demo) |
| TC-09 | Search | Tap the search bar and type 3 or more letters | Matching books appear | Not run |
| TC-10 | View all | Tap "View all" on a genre, then Back | The genre grid opens and Back returns | Not run |
| TC-11 | Log out | Settings → Log out | Asks first, then returns to sign-in | Not run |

### Library and book details

| ID | Test case | Steps | Expected result | Result |
|---|---|---|---|---|
| TC-12 | Library list | Open the Library tab | Your books show with their listing status | Pass (demo) |
| TC-13 | Add to Library | Tap "I own this" and "Wishlist" on two books | A message appears and each shows in Library | Not run |
| TC-14 | Book menu | Tap ⋯ on a book | "List on Feed" or "Edit listing", plus "Remove book" | Not run |
| TC-15 | Edit from Library | Choose "Edit listing" | The editor for that book opens | Not run |
| TC-16 | Remove a listed book | Remove a book that is on the Feed | The book and its post disappear | Not run |

### Feed

| ID | Test case | Steps | Expected result | Result |
|---|---|---|---|---|
| TC-17 | View Feed | Open the Feed tab | Posts show book, owner, status and meetup spot | Pass (demo) |
| TC-18 | Create a listing | Feed → +, pick a book and a spot, Post | The post appears at the top, marked "(you)" | Pass (demo) |
| TC-19 | Spot limit | Try to choose a 4th meetup place | It is refused | Not run |
| TC-20 | Pin on map | Pin a place, confirm | The same form returns with your choices and the pin | Not run |
| TC-21 | Edit status | Edit your post, choose Reserved, Save | The post shows Reserved | Pass (demo) |
| TC-22 | Hide a listing | My listings → switch off | Asks first; other accounts no longer see it | Not run |
| TC-23 | Remove a listing | Edit → Remove listing → confirm | Asks first; the post disappears | Pass (demo) |
| TC-24 | Filters | Tap All, Available, Near me, Wishlist matches | Each shows only matching posts | Not run |
| TC-25 | Owner profile | Tap a post's owner | Their profile shows "Their listings" | Not run |

### Map, Profile, Settings and Messages

| ID | Test case | Steps | Expected result | Result |
|---|---|---|---|---|
| TC-26 | Map from a post | Tap "Meet at" on a post and allow location | The map shows that book's spots with counts | Pass (demo) |
| TC-27 | Map pin sheet | Tap a pin | The spot's sheet opens with its books | Not run |
| TC-28 | Settings loads | Profile → Settings, scroll down | Fields are filled; Save, Log out and Delete are reachable | Pass (demo) |
| TC-29 | Save profile | Change bio and photo, Save, reopen | The new values stay | Not run |
| TC-30 | Discard changes | Change a field, go back, Discard, reopen | The old values return | Not run |
| TC-31 | Messages | Open the Messages tab | "Messaging is coming soon" with a Feed button | Pass (demo) |

### API turned off

| ID | Test case | Steps | Expected result | Result |
|---|---|---|---|---|
| TC-32 | Feed without API | Stop the API and open the Feed | An error with "Try again" | Not run |
| TC-33 | Other screens without API | Open Library and a book | Both still open | Not run |
| TC-34 | Recovery | Start the API and tap "Try again" | The Feed loads | Not run |

## Automated cases

`npm test` covers the server rules behind TC-01 to TC-06, including hidden listings, spot and book
counts, title punctuation and rate limits. It does not tap through the app.

## Known limits (no need to report)

- Messages is a placeholder.
- The edit screen cannot change condition, exchange type or note.
- "Wishlist matches" only matches the exact same edition.

## Reporting a problem

Send: the test case ID, what happened, your phone and Android version, a screenshot, and the API
terminal output for Feed or deletion problems.
