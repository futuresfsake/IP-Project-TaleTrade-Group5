/* eslint-env jest */
jest.mock('@react-native-firebase/app', () => ({}));
jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(() => ({ currentUser: null })),
  getIdToken: jest.fn(() => Promise.resolve('test-token')),
  // Report "signed out" so the Auth stack renders.
  onAuthStateChanged: jest.fn((_auth, cb) => {
    cb(null);
    return jest.fn();
  }),
  onIdTokenChanged: jest.fn(() => jest.fn()),
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  deleteUser: jest.fn(),
  updateProfile: jest.fn(),
  reload: jest.fn(),
}));
jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(),
  doc: jest.fn(),
  collection: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  onSnapshot: jest.fn(() => jest.fn()),
  writeBatch: jest.fn(),
  serverTimestamp: jest.fn(),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-vector-icons/FontAwesome', () => {
  const Icon = () => null;
  Icon.loadFont = jest.fn();
  return Icon;
});
jest.mock('@maplibre/maplibre-react-native', () => ({
  Map: 'Map',
  Camera: 'Camera',
  ViewAnnotation: 'ViewAnnotation',
}));
