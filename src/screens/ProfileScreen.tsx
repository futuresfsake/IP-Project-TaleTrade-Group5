import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, StatusBar, Image, Linking, ActivityIndicator,
} from 'react-native';
import { dialog } from '../component/ui/AppDialog';
import { Settings, ChevronRight, Mail, MapPin } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookCover, ScreenHeader, StatusBadge } from '../component/feed/ui';
import { getUserListings } from '../services/feedService';
import { spotSummary, toBookData } from '../services/feedHelpers';
import type { FeedItem } from '../types';
import { colors, shadow } from '../theme/colors';
import { getAuth } from '@react-native-firebase/auth';
import { useIsFocused } from '@react-navigation/native';
import { getUserProfile } from '../services/userService';
import { getUserInventory } from '../services/userbookService';
import { getSpot } from '../services/map/meetupService';

const ProfileScreen = ({ navigation, route }: any) => {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const [bookCount, setBookCount] = useState(0);
  const [userName, setUserName] = useState('...');
  const [bio, setBio] = useState('...');
  const [initials, setInitials] = useState('??');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [socialLink, setSocialLink] = useState<string | null>(null);
  const [spotNames, setSpotNames] = useState<string[]>([]);
  // null while loading, or when the TaleTrade API is unreachable.
  const [listings, setListings] = useState<FeedItem[] | null>(null);
  const [listingsFailed, setListingsFailed] = useState(false);

  const visitedUserId = route?.params?.userId;
  const hideHeader = route?.params?.hideHeader;
  const isPushed = route?.name === 'UserProfileView'; 
  
  const currentUid = getAuth().currentUser?.uid;
  const targetUid = visitedUserId || currentUid;
  const isOwnProfile = !visitedUserId || visitedUserId === currentUid;

  useEffect(() => {
    setUserName('...');
    setBio('...');
    setSocialLink(null);
    setProfileImage(null);
    setInitials('??');
    setBookCount(0);
    setSpotNames([]);
    setListings(null);
    setListingsFailed(false);
  }, [visitedUserId]);

  const fetchAndSetUserData = useCallback(async () => {
    if (!targetUid) return;
    
    try {
      const userData = await getUserProfile(targetUid);
      if (userData) {
        setUserName(userData.username || 'Explorer');
        setBio(userData.bio || (isOwnProfile ? 'Introduce yourself to the community! 📚' : 'No bio available yet.'));
        setProfileImage(userData.photoURL || null);
        setSocialLink(userData.socialLink || null);

        const nameParts = (userData.username || 'Explorer').trim().split(' ');
        setInitials(nameParts.length > 1 
          ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase() 
          : nameParts[0][0].toUpperCase()
        );

        const spotIds: string[] = Array.isArray(userData.preferredSpots) ? userData.preferredSpots : [];
        const spots = await Promise.all(spotIds.map(id => getSpot(id)));
        setSpotNames(spots.filter(s => s && s.active).map(s => s!.name));
      }

      const inventory = await getUserInventory(targetUid);
      setBookCount(inventory?.length || 0);

    } catch (error) {
      console.error("Error in fetchAndSetUserData:", error);
    }
  }, [targetUid, isOwnProfile]);

  useEffect(() => {
    if (isFocused) {
      fetchAndSetUserData();
    }
  }, [isFocused, fetchAndSetUserData]);

  // The listings shown on a reader's profile.
  useEffect(() => {
    if (!isPushed || !targetUid || !isFocused) return;
    let active = true;
    getUserListings(targetUid)
      .then(items => {
        if (!active) return;
        setListings(items);
        setListingsFailed(false);
      })
      .catch(() => active && setListingsFailed(true));
    return () => {
      active = false;
    };
  }, [isPushed, targetUid, isFocused]);

  const openListing = (item: FeedItem) => navigation.push('BookDetail', { bookData: toBookData(item.book) });

  const handleContactPress = async () => {
    if (!socialLink) return;
    let url = socialLink.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.error("Linking Error:", error);
      dialog.alert("Link Error", "Could not open the link.");
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      {/* A pushed profile gets a back button; the Profile tab gets its title. */}
      {(isPushed || !hideHeader) && (
        <ScreenHeader
          title={isOwnProfile ? 'Profile' : 'Reader Profile'}
          onBack={isPushed ? () => navigation.goBack() : undefined}
          right={
            isOwnProfile && !isPushed ? (
              <TouchableOpacity
                accessibilityLabel="Settings"
                onPress={() => navigation.navigate('Settings')}
                style={styles.settingsButton}
              >
                <Settings color={colors.accent} size={22} />
              </TouchableOpacity>
            ) : undefined
          }
        />
      )}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.hero}>
            <View style={styles.avatar}>
              {profileImage ? (
                <Image source={{ uri: profileImage.replace('http://', 'https://') }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarInitials}>{initials}</Text>
              )}
            </View>
            <Text style={styles.userName}>{userName}</Text>
            <Text style={styles.bio}>{bio}</Text>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{bookCount}</Text>
              <Text style={styles.statLabel}>Books owned</Text>
            </View>
          </View>
        </View>

        {isPushed ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {isOwnProfile ? 'My listings' : 'Their listings'}
              {listings ? ` (${listings.length})` : ''}
            </Text>
            {listingsFailed ? (
              <Text style={styles.empty}>Couldn’t load listings right now.</Text>
            ) : !listings ? (
              <ActivityIndicator color={colors.primary} />
            ) : listings.length === 0 ? (
              <Text style={styles.empty}>No books listed yet.</Text>
            ) : (
              listings.map(item => (
                <TouchableOpacity key={item.id} style={styles.listing} onPress={() => openListing(item)}>
                  <BookCover uri={item.book.thumbnail} width={48} height={70} radius={10} />
                  <View style={styles.listingText}>
                    <Text style={styles.listingTitle} numberOfLines={2}>{item.book.title}</Text>
                    <Text style={styles.listingMeta} numberOfLines={1}>{spotSummary(item.spots)}</Text>
                    <StatusBadge status={item.status} />
                  </View>
                  <ChevronRight color={colors.muted} size={18} />
                </TouchableOpacity>
              ))
            )}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Where I can meet</Text>
          {spotNames.length > 0 ? (
            <View style={styles.chips}>
              {spotNames.map(name => (
                <View key={name} style={styles.spotChip}>
                  <MapPin color={colors.purple} size={14} />
                  <Text style={styles.spotChipText}>{name}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.empty}>
              {isOwnProfile ? 'Pick meetup spots in Settings.' : 'No meetup spots chosen.'}
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Socials</Text>
          {socialLink ? (
            <TouchableOpacity style={styles.contactRow} onPress={handleContactPress}>
              <View style={styles.iconTile}>
                <Mail color={colors.accent} size={18} />
              </View>
              <Text style={styles.contactText}>{isOwnProfile ? 'My contact link' : 'Contact reader'}</Text>
              <ChevronRight color={colors.muted} size={18} />
            </TouchableOpacity>
          ) : (
            <Text style={styles.empty}>
              {isOwnProfile ? 'Add a contact link in Settings.' : 'No contact links shared.'}
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  settingsButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', elevation: 3 },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 130, gap: 12 },
  card: { backgroundColor: colors.white, borderRadius: 24, padding: 16, gap: 10, ...shadow },
  hero: { alignItems: 'center', gap: 8, paddingVertical: 4 },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitials: { fontSize: 30, fontWeight: '800', color: colors.purple },
  userName: { fontSize: 22, fontWeight: '900', color: colors.heading },
  bio: { fontSize: 14, color: colors.body, textAlign: 'center', lineHeight: 20, fontStyle: 'italic' },
  stat: { alignSelf: 'stretch', alignItems: 'center', backgroundColor: colors.field, borderRadius: 18, paddingVertical: 12, marginTop: 6 },
  statValue: { fontSize: 20, fontWeight: '900', color: colors.accent },
  statLabel: { fontSize: 12, fontWeight: '600', color: colors.muted },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.heading },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  spotChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.chip, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  spotChipText: { fontSize: 13, fontWeight: '600', color: colors.purple },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  iconTile: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' },
  contactText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.body },
  empty: { color: colors.muted, fontStyle: 'italic' },
  listing: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  listingText: { flex: 1, gap: 3 },
  listingTitle: { fontSize: 14, fontWeight: '700', color: colors.ink },
  listingMeta: { fontSize: 12, color: colors.muted },
});

export default ProfileScreen;