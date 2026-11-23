import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from '@react-native-firebase/auth';
import { getFirestore, doc, setDoc, serverTimestamp } from '@react-native-firebase/firestore';

export const registerUser = async (email: string, password: string, username: string, birthday: string) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(getAuth(), email, password);
    const { uid } = userCredential.user;

    await setDoc(doc(getFirestore(), 'Users', uid), {
      username: username,
      email: email,
      birthday: birthday,
      bio: "Hello! I'm new here and ready to trade tales.",
      createdAt: serverTimestamp(),
      lastUpdated: serverTimestamp(),
    });

    return userCredential.user;
  } catch (error: any) {
    throw error;
  }
};

export const loginUser = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(getAuth(), email, password);
    return userCredential.user;
  } catch (error: any) {
    throw error;
  }
};
