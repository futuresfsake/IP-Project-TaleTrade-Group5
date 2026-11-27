import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
   ScrollView, KeyboardAvoidingView,
  Platform, Image, ActivityIndicator,
  Linking, PermissionsAndroid,
} from 'react-native';
import { dialog } from '../component/ui/AppDialog';
import { ChevronRight, User, Trash2, CheckCircle, LogOut } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, usePreventRemove } from '@react-navigation/native';
import { AppButton, Field, ScreenHeader } from '../component/feed/ui';
import { colors, shadow } from '../theme/colors';
import { getAuth, signOut as firebaseSignOut, deleteUser } from '@react-native-firebase/auth';
import { getFirestore, doc, collection, getDocs, writeBatch } from '@react-native-firebase/firestore';
import { updateUserInDb, getUserProfile, updateUserBio, updateUserProfileImage, updateUserSocialLink } from '../services/userService';
import { getActiveSpots, setPreferredSpots, toggleSpotSelection, MAX_PREFERRED_SPOTS } from '../services/map/meetupService';
import type { MeetupSpot } from '../types';
import { deleteMyListings } from '../services/feedService';
import { ApiError } from '../services/apiClient';
import { launchImageLibrary } from 'react-native-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
// import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from '@env';

// Then in your fetch:
// const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload` ...);

const SettingScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const [newName, setNewName] = useState('');
  const [newBio, setNewBio] = useState('');
  const [newSocialLink, setNewSocialLink] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [tempImage, setTempImage] = useState<string | null>(null);
  const [spots, setSpots] = useState<MeetupSpot[]>([]);
  const [selectedSpots, setSelectedSpots] = useState<string[]>([]);
  const [spotLimitHit, setSpotLimitHit] = useState(false);
  const [savedSpots, setSavedSpots] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  // The profile fields as last loaded, to know whether anything is unsaved.
  const [original, setOriginal] = useState<{ name: string; bio: string; link: string } | null>(null);
  const [done, setDone] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const dirty =
    !done &&
    !!original &&
    (newName !== original.name ||
      newBio !== original.bio ||
      newSocialLink !== original.link ||
      tempImage !== profileImage ||
      selectedSpots.join(',') !== savedSpots.join(','));
  usePreventRemove(dirty, ({ data }) => {
    dialog.alert('Discard your changes?', 'They have not been saved.', [
      { text: 'Keep editing', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          // Put the saved values back, in case this screen is shown again.
          if (original) {
            setNewName(original.name);
            setNewBio(original.bio);
            setNewSocialLink(original.link);
          }
          setTempImage(profileImage);
          setSelectedSpots(savedSpots);
          navigation.dispatch(data.action);
        },
      },
    ]);
  });
  useEffect(() => {
    if (done) navigation.goBack();
  }, [done, navigation]);

  // Load every time the screen is shown, unless that would overwrite unsaved edits.
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  useFocusEffect(
    useCallback(() => {
      if (!dirtyRef.current) loadUserData();
    }, []),
  );

  const loadUserData = async () => {
    const user = getAuth().currentUser;
    if (!user) return;
    setLoadFailed(false);
    // Spots load separately, so a slow spot list never leaves the profile fields empty.
    const spotsRequest = getActiveSpots().catch((): MeetupSpot[] | null => null);
    const userData = await getUserProfile(user.uid);
    if (!userData) {
      setLoadFailed(true);
      return;
    }
    const fields = { name: userData.username || '', bio: userData.bio || '', link: userData.socialLink || '' };
    setNewName(fields.name);
    setNewBio(fields.bio);
    setNewSocialLink(fields.link);
    setOriginal(fields);
    setProfileImage(userData.photoURL || null);
    setTempImage(userData.photoURL || null);

    const activeSpots = await spotsRequest;
    const saved: string[] = Array.isArray(userData.preferredSpots) ? userData.preferredSpots : [];
    if (activeSpots) {
      setSpots(activeSpots);
      // Drop saved picks that are no longer active so they can't be re-saved.
      const activeIds = new Set(activeSpots.map(s => s.id));
      const stillActive = saved.filter(id => activeIds.has(id));
      setSelectedSpots(stillActive);
      setSavedSpots(stillActive);
    } else {
      // Spots failed to load: keep the saved picks untouched (the card shows its empty state).
      setSelectedSpots(saved);
      setSavedSpots(saved);
    }
  };

  const requestGalleryPermission = async () => {
    if (Platform.OS === 'ios') return true;
    if (Platform.OS === 'android') {
      try {
        const permission = Platform.Version >= 33 
          ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES 
          : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
        const granted = await PermissionsAndroid.request(permission);
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch { return false; }
    }
    return false;
  };

  const handlePickImage = async () => {
    const hasPermission = await requestGalleryPermission();
    if (!hasPermission) {
      dialog.alert("Permission Denied", "Open settings to allow gallery access.", 
        [{ text: "Cancel" }, { text: "Open Settings", onPress: () => Linking.openSettings() }]
      );
      return;
    }

    launchImageLibrary({ mediaType: 'photo', quality: 0.7 }, (response) => {
      if (response.assets && response.assets[0].uri) {
        setTempImage(response.assets[0].uri);
      }
    });
  };

  /** Uploads the newly picked photo to Cloudinary and stores its URL. Throws on failure. */
  const uploadPhoto = async (uid: string, uri: string) => {
    // Create the form data for the cloud upload
    const data = new FormData();
    data.append('file', { uri, type: 'image/jpeg', name: 'profile.jpg' } as any);
    // Use your newly created preset and cloud name
    data.append('upload_preset', 'TaleTrade');
    const cloudName = 'dg4xa8pjg';

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: data,
    });
    const result = await response.json();
    if (!result.secure_url) {
      // Log the error if Cloudinary returns one (e.g., preset name typo)
      console.error('Cloudinary Error:', result);
      throw new Error('Cloud upload failed. Please check your internet connection.');
    }
    // Save the permanent HTTPS URL to Firestore
    await updateUserProfileImage(uid, result.secure_url);
    setProfileImage(result.secure_url);
    setTempImage(result.secure_url);
  };

  const handleToggleSpot = (spotId: string) => {
    const result = toggleSpotSelection(selectedSpots, spotId);
    setSelectedSpots(result.spotIds);
    setSpotLimitHit(result.limitReached);
  };

  /** Saves everything on this screen: photo, profile fields and meetup spots. */
  const handleSave = async () => {
    const user = getAuth().currentUser;
    // Never save before the profile has loaded: empty fields would overwrite it.
    if (!user || !original) return;

    if (newName.trim().length < 3) {
      dialog.alert("Error", "Username is too short!");
      return;
    }

    setSaving(true);
    try {
      if (tempImage && tempImage !== profileImage) {
        await uploadPhoto(user.uid, tempImage);
      }
      await updateUserInDb(user.uid, newName.trim());
      await updateUserBio(user.uid, newBio.trim());
      await updateUserSocialLink(user.uid, newSocialLink.trim());
      // Only rewrite the spots when they changed (it also updates every owned book).
      if (selectedSpots.join(',') !== savedSpots.join(',')) {
        await setPreferredSpots(user.uid, selectedSpots);
        setSavedSpots(selectedSpots);
      }
      dialog.alert("Success!", "Your changes are saved ✨", [
        { text: "OK", onPress: () => setDone(true) }
      ]);
    } catch (error: any) {
      dialog.alert("Error", error.message || "Could not save your changes.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    dialog.alert("Log Out", "Are you sure? 🥺", [
      { text: "Stay", style: "cancel" },
      { text: "Log Out", style: "destructive", onPress: () => firebaseSignOut(getAuth()) }
    ]);
  };

  const handleDeleteAccount = () => {
    const user = getAuth().currentUser;
    if (!user) return;
    dialog.alert("Wait! 🥺", "This will delete your account permanently. Proceed?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete Everything", style: "destructive", onPress: async () => {
        try {
          // Firebase only allows deleting an account shortly after sign-in.
          // Check first so we never wipe data and then fail to delete the account.
          const lastSignIn = user.metadata.lastSignInTime
            ? new Date(user.metadata.lastSignInTime).getTime()
            : 0;
          if (Date.now() - lastSignIn > 5 * 60 * 1000) {
            dialog.alert("Security Check", "Please log out and log back in before deleting.");
            return;
          }

          // Feed posts can only be removed by the API, and only while the account still exists,
          // so they go first. If that fails, nothing has been deleted yet.
          try {
            await deleteMyListings();
          } catch (error) {
            // An app with no API address has no Feed to clean up.
            if (!(error instanceof ApiError && error.code === 'not_configured')) {
              dialog.alert("Could not delete account", "Your Feed posts could not be removed, so nothing was deleted. Check your connection and try again.");
              return;
            }
          }

          const db = getFirestore();
          const myBooks = await getDocs(collection(db, 'Users', user.uid, 'myBooks'));
          const wishlist = await getDocs(collection(db, 'Users', user.uid, 'wishlist'));

          // Batches are limited to 500 writes, so chunk the refs.
          const refs = [
            ...myBooks.docs.map(d => d.ref),
            ...myBooks.docs.map(d => doc(db, 'bookOwners', d.id, 'owners', user.uid)),
            ...wishlist.docs.map(d => d.ref),
            doc(db, 'Users', user.uid),
          ];
          for (let i = 0; i < refs.length; i += 400) {
            const batch = writeBatch(db);
            refs.slice(i, i + 400).forEach(r => batch.delete(r));
            await batch.commit();
          }

          await AsyncStorage.removeItem('user_profile_image');
          await deleteUser(user);
        } catch { 
          dialog.alert("Security Check", "Please log out and log back in before deleting."); 
        }
      }}
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Settings" subtitle="Manage your profile and account" onBack={() => navigation.goBack()} />

      {!original ? (
        <View style={styles.pending}>
          {loadFailed ? (
            <>
              <Text style={styles.hint}>Couldn’t load your profile. Check your connection.</Text>
              <AppButton label="Try again" onPress={loadUserData} />
            </>
          ) : (
            <ActivityIndicator size="large" color={colors.primary} />
          )}
        </View>
      ) : (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Profile photo</Text>
            <View style={styles.photoRow}>
              <View style={styles.photo}>
                {tempImage ? (
                  <Image source={{ uri: tempImage }} style={styles.photoImage} />
                ) : (
                  <User color={colors.purple} size={28} />
                )}
              </View>
              <AppButton small variant="secondary" label="Change photo" onPress={handlePickImage} />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Public profile</Text>
            <Field label="Username" value={newName} onChangeText={setNewName} placeholder="Your display name" />
            <Field label="About me" value={newBio} onChangeText={setNewBio} placeholder="Tell us about your favorite books..." multiline />
            <Field
              label="Contact link (FB, IG, etc.)"
              value={newSocialLink}
              onChangeText={setNewSocialLink}
              placeholder="https://facebook.com/yourprofile"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Meetup preferences</Text>
            <Text style={[styles.hint, spotLimitHit && styles.limit]}>
              {spotLimitHit
                ? `You can only pick ${MAX_PREFERRED_SPOTS} spots. Deselect one to choose another.`
                : `Pick up to ${MAX_PREFERRED_SPOTS} public places · ${selectedSpots.length}/${MAX_PREFERRED_SPOTS} selected`}
            </Text>
            {spots.length === 0 ? (
              <Text style={styles.hint}>No meetup spots are available yet.</Text>
            ) : (
              spots.map(spot => {
                const selected = selectedSpots.includes(spot.id);
                return (
                  <TouchableOpacity
                    key={spot.id}
                    style={[styles.spotRow, selected && styles.spotRowSelected]}
                    onPress={() => handleToggleSpot(spot.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                  >
                    <View style={styles.flex}>
                      <Text style={styles.spotName}>{spot.name}</Text>
                      <Text style={styles.spotMeta}>{spot.type} · {spot.city}</Text>
                    </View>
                    {selected && <CheckCircle color={colors.accent} size={20} />}
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          <AppButton label="Save changes" onPress={handleSave} loading={saving} />

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Account</Text>
            <TouchableOpacity style={styles.accountRow} onPress={handleLogout}>
              <LogOut color={colors.purple} size={20} />
              <Text style={styles.accountText}>Log out</Text>
              <ChevronRight color={colors.muted} size={18} />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.accountRow} onPress={handleDeleteAccount}>
              <Trash2 color={colors.danger} size={20} />
              <Text style={[styles.accountText, styles.dangerText]}>Delete account</Text>
              <ChevronRight color={colors.muted} size={18} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pending: { alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingTop: 60 },
  container: { flex: 1, backgroundColor: colors.cream },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 130, gap: 16 },
  card: { backgroundColor: colors.white, borderRadius: 24, padding: 16, gap: 12, ...shadow },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.heading },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  photo: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoImage: { width: '100%', height: '100%' },
  hint: { fontSize: 13, color: colors.muted },
  limit: { color: colors.danger, fontWeight: '700' },
  spotRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.field, padding: 12, borderRadius: 16, borderWidth: 1.5, borderColor: 'transparent' },
  spotRowSelected: { borderColor: colors.accent, backgroundColor: colors.selected },
  spotName: { fontSize: 14, fontWeight: '700', color: colors.ink },
  spotMeta: { fontSize: 12, color: colors.muted, marginTop: 1, textTransform: 'capitalize' },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  accountText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.ink },
  dangerText: { color: colors.danger },
  divider: { height: 1, backgroundColor: colors.border },
});

export default SettingScreen;