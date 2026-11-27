import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  
} from 'react-native';
import { dialog } from '../component/ui/AppDialog';
import { getAuth, updateProfile, reload, signOut } from '@react-native-firebase/auth';
import { saveUserGenres } from '../services/genreService';
import { getUsername } from '../services/userService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton, Chip } from '../component/feed/ui';
import { colors } from '../theme/colors';

const MIN_GENRES = 3;

const GENRES = [
  "Contemporary", "Memoir", "Dystopian", "Self-Help", 
  "Paranormal", "Young Adult", "Classics", "Graphic Novel", 
  "Thriller & Suspense", "Fantasy", "Mystery", "Historical Fiction"
];

export default function PickAGenreScreen() {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const toggleGenre = (genre: string) => {
    setSelected(prev => 
      prev.includes(genre) 
        ? prev.filter(g => g !== genre) 
        : [...prev, genre]
    );
  };

  // There is no previous screen during onboarding: leaving means signing out.
  const handleLeave = () => {
    dialog.alert('Sign out?', 'You can pick your genres the next time you log in.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut(getAuth()) },
    ]);
  };

  const handleNext = async () => {
    if (selected.length < MIN_GENRES) {
      dialog.alert("Select at least 3 genres");
      return;
    }

    const user = getAuth().currentUser;
    if (!user) {
      dialog.alert('Error', 'You must be signed in to save your genres.');
      return;
    }

    setLoading(true);
    try {
      // 1. Save preferences to your database
      await saveUserGenres(user.uid, selected);

      // 2. Fetch the username from your database (stored during registration)
      const dbUsername = await getUsername(user.uid);

      // 3. Update the Firebase Auth Profile. 
      // This is what App.tsx is watching to decide when to show the Home Screen.
      await updateProfile(user, {
        displayName: dbUsername || "Explorer"
      });

      await reload(user);

      /* 
         STRICT RULE: No navigation.navigate('AppTabs') here. 
         App.tsx will automatically detect the displayName change 
         and swap the screens for you. 
      */

    } catch (error) {
      console.error("Genre Selection Error:", error);
      dialog.alert("Error", "Failed to save preferences. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const ready = selected.length >= MIN_GENRES;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={handleLeave}>
          <Text style={styles.leave}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>What do you love to read?</Text>
        <Text style={styles.subtitle}>Pick at least {MIN_GENRES}. We’ll tune your Home to match.</Text>

        <Text style={styles.progressText}>{selected.length} selected · {MIN_GENRES} minimum</Text>
        <View style={styles.progress}>
          {Array.from({ length: MIN_GENRES }, (_, i) => (
            <View key={i} style={[styles.progressStep, i < selected.length && styles.progressDone]} />
          ))}
        </View>

        <View style={styles.cloud}>
          {GENRES.map((genre) => (
            <Chip key={genre} label={genre} selected={selected.includes(genre)} onPress={() => toggleGenre(genre)} />
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
        <AppButton label="Continue" onPress={handleNext} disabled={!ready} loading={loading} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  topBar: { alignItems: 'flex-end', paddingHorizontal: 20, paddingVertical: 12 },
  leave: { fontSize: 15, fontWeight: '700', color: colors.accent },
  body: { paddingHorizontal: 20, paddingBottom: 20 },
  title: { fontSize: 30, fontWeight: '900', color: colors.heading },
  subtitle: { fontSize: 15, color: colors.muted, marginTop: 8, lineHeight: 22 },
  progressText: { fontSize: 13, fontWeight: '700', color: colors.purple, marginTop: 20, marginBottom: 8 },
  progress: { flexDirection: 'row', gap: 6, marginBottom: 24 },
  progressStep: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.white },
  progressDone: { backgroundColor: colors.accent },
  cloud: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  footer: { paddingHorizontal: 20, paddingTop: 16 },
});
