# TaleTrade

A book lending mobile app built with React Native and Firebase.

## Folder Structure

```
TaleTrade/
├── App.tsx                  # Root component — handles auth state and navigation
├── index.js                 # App entry point
├── .env                     # Environment variables (Google Books API key)
├── src/
│   ├── api/
│   │   ├── firebaseConfig.ts    # Firebase web SDK initialization
│   │   └── private.ts           # Firebase API keys
│   ├── assets/
│   │   ├── Logo.png
│   │   ├── Logo.svg
│   │   ├── logoNoBg.png
│   │   └── logoWbg.png
│   ├── component/
│   │   ├── BookCard.tsx         # Reusable book card component
│   │   └── TabBar.tsx           # Custom bottom tab bar
│   ├── navigation/
│   │   ├── AuthNavigator.tsx    # Auth flow (Launch → Login → Register)
│   │   ├── TabNavigator.tsx     # Main app bottom tabs
│   │   └── DrawerNavigator.tsx  # Drawer navigation (unused)
│   ├── screens/
│   │   ├── auth/
│   │   │   ├── LoginScreen.tsx
│   │   │   └── RegisterScreen.tsx
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
│   │   ├── userService.ts       # User profile data (Firestore)
│   │   └── userbookService.ts   # User's book collection (Firestore)
│   └── types/
│       └── index.ts             # TypeScript type definitions
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
   ```

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
| `READ` | `getBookOwners(bookId)` | Get all users who own a specific book | Yes |
| `WRITE` | `addBookToUserInventory(bookData)` | Add a book to user's inventory and register as owner | Yes |
| `WRITE` | `addToWishlist(bookData)` | Add a book to user's wishlist | Yes |
| `WRITE` | `updateBookStatus(bookId, status)` | Update the status of a book in inventory | Yes |
| `DELETE` | `removeBookFromInventory(bookId)` | Remove a book from inventory and owner registry | Yes |

### Firestore — Wishlist (inline in `WishlistScreen.tsx`)

Collection: `Users/{uid}/wishlist/{bookId}`

| Method | Operation | Description | Auth Required |
|--------|-----------|-------------|---------------|
| `LISTEN` | `onSnapshot(Users/{uid}/wishlist)` | Real-time listener for wishlist updates | Yes |
| `DELETE` | `deleteDoc(Users/{uid}/wishlist/{bookId})` | Remove a book from the wishlist | Yes |
