# Changelog

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
