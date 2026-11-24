import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from '@react-native-firebase/firestore';

export const getUserProfile = async (uid: string) => {
  try {
    const snapshot = await getDoc(doc(getFirestore(), 'Users', uid));
    if (snapshot.exists()) {
      const data = snapshot.data();
      console.log("Fetched User Data for:", uid, data);
      return data;
    }
    return null;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
};

export const updateUserBio = async (uid: string, bio: string) => {
  try {
    return await setDoc(doc(getFirestore(), 'Users', uid), {
      bio: bio,
      lastUpdated: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.error("Error updating bio:", error);
    throw error;
  }
};

export const updateUserInDb = async (uid: string, username: string) => {
  try {
    return await setDoc(doc(getFirestore(), 'Users', uid), {
      username: username,
      lastUpdated: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.error("Error updating username:", error);
    throw error;
  }
};

export const getUsername = async (uid: string) => {
  try {
    const snapshot = await getDoc(doc(getFirestore(), 'Users', uid));
    return snapshot.exists() ? snapshot.data()?.username : null;
  } catch {
    return null;
  }
};

export const updateUserProfileImage = async (uid: string, imageUrl: string) => {
  const secureUrl = imageUrl.replace('http://', 'https://');

  try {
    return await setDoc(doc(getFirestore(), 'Users', uid), {
      photoURL: secureUrl,
      lastUpdated: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.error("Error updating profile image:", error);
    throw error;
  }
};

export const updateUserSocialLink = async (uid: string, link: string) => {
  try {
    return await setDoc(doc(getFirestore(), 'Users', uid), {
      socialLink: link,
      lastUpdated: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.error("Error updating social link:", error);
    throw error;
  }
};
