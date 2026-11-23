import { getFirestore, doc, setDoc, getDoc } from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';

export const saveUserGenres = async (uid: string, genres: string[]) => {
  try {
    await setDoc(doc(getFirestore(), 'Users', uid), {
      genres: genres,
    }, { merge: true });
  } catch (error) {
    console.error('Error saving genres:', error);
    throw error;
  }
};

export const getUserGenres = async (): Promise<string[]> => {
  try {
    const user = getAuth().currentUser;
    if (!user) return [];

    const snapshot = await getDoc(doc(getFirestore(), 'Users', user.uid));
    const userData = snapshot.data();
    if (userData && userData.genres) {
      return userData.genres;
    }
    return [];
  } catch (error) {
    console.error('MOBDEV Service Error:', error);
    return [];
  }
};
