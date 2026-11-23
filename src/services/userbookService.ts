import { getFirestore, doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp } from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';

const extractBookFields = (bookData: any) => {
  const v = bookData.volumeInfo || bookData;

  return {
    bookId: bookData.id || bookData.bookId,
    title: v.title || 'Untitled',
    author: Array.isArray(v.authors)
      ? v.authors.join(', ')
      : (v.author || 'Unknown Author'),
    thumbnail: v.imageLinks?.thumbnail?.replace('http://', 'https://') || v.thumbnail || null,
    description: v.description || '',
    publisher: v.publisher || '',
    publishedDate: v.publishedDate || '',
    pageCount: v.pageCount || 0,
    categories: v.categories || [],
    isbn: v.industryIdentifiers?.[0]?.identifier || v.isbn || '',
  };
};

export const addBookToUserInventory = async (bookData: any) => {
  const userId = getAuth().currentUser?.uid;
  if (!userId) throw new Error("User not authenticated");

  const db = getFirestore();
  const fields = extractBookFields(bookData);
  const batch = writeBatch(db);

  const myBookRef = doc(db, 'Users', userId, 'myBooks', bookData.id);
  batch.set(myBookRef, {
    ...fields,
    status: 'owned',
    addedAt: serverTimestamp(),
  });

  const ownerRef = doc(db, 'bookOwners', bookData.id, 'owners', userId);
  batch.set(ownerRef, {
    userId,
    addedAt: serverTimestamp(),
  });

  await batch.commit();
};

export const getUserInventory = async (providedUserId?: string) => {
  const userId = providedUserId || getAuth().currentUser?.uid;
  if (!userId) return [];

  try {
    const snapshot = await getDocs(collection(getFirestore(), 'Users', userId, 'myBooks'));

    if (snapshot && !snapshot.empty) {
      return snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
      }));
    }
    return [];
  } catch (error) {
    console.error("Error fetching inventory:", error);
    return [];
  }
};

export const updateBookStatus = async (bookId: string, newStatus: string) => {
  const userId = getAuth().currentUser?.uid;
  if (!userId) throw new Error("User not authenticated");

  await updateDoc(doc(getFirestore(), 'Users', userId, 'myBooks', bookId), { status: newStatus });
};

export const removeBookFromInventory = async (bookId: string) => {
  const userId = getAuth().currentUser?.uid;
  if (!userId) throw new Error("User not authenticated");

  const db = getFirestore();
  const batch = writeBatch(db);

  batch.delete(doc(db, 'Users', userId, 'myBooks', bookId));
  batch.delete(doc(db, 'bookOwners', bookId, 'owners', userId));

  await batch.commit();
};

export const addToWishlist = async (bookData: any) => {
  const userId = getAuth().currentUser?.uid;
  if (!userId) throw new Error("User not authenticated");

  const fields = extractBookFields(bookData);

  await setDoc(doc(getFirestore(), 'Users', userId, 'wishlist', bookData.id), {
    ...fields,
    addedAt: serverTimestamp(),
  });
};

export const getBookOwners = async (bookId: string) => {
  if (!bookId || typeof bookId !== 'string') {
    console.log("getBookOwners blocked: Missing or invalid bookId string path coordinate.");
    return [];
  }
  const currentUserId = getAuth().currentUser?.uid;
  const db = getFirestore();

  try {
    const snapshot = await getDocs(collection(db, 'bookOwners', bookId, 'owners'));

    if (snapshot.empty) return [];

    const uniqueOwnersMap = new Map();

    await Promise.all(
      snapshot.docs.map(async (d) => {
        const { userId } = d.data();
        if (!uniqueOwnersMap.has(userId)) {
          const userDoc = await getDoc(doc(db, 'Users', userId));
          const userData = userDoc.data();
          const isMe = userId === currentUserId;

          uniqueOwnersMap.set(userId, {
            id: userId,
            username: isMe
              ? "You"
              : (userData?.username || userData?.displayName || 'Anonymous'),
            photo: userData?.photoURL || null,
            isMe,
          });
        }
      })
    );

    const owners = Array.from(uniqueOwnersMap.values());
    return owners.sort((a, b) => (b.isMe ? 1 : 0) - (a.isMe ? 1 : 0));

  } catch (error) {
    console.error("Error fetching owners:", error);
    return [];
  }
};
