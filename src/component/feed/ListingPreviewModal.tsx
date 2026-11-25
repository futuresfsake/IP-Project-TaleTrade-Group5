// Shows a listing exactly as other readers see it in the Feed (used from "My listings").
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import type { FeedItem } from '../../types';
import ListingCard from './ListingCard';
import { AppButton } from './ui';

interface ListingPreviewModalProps {
  item: FeedItem | null;
  onClose: () => void;
  onEdit: (item: FeedItem) => void;
  onOpenBook: (item: FeedItem) => void;
}

const noop = () => {};

const ListingPreviewModal = ({ item, onClose, onEdit, onOpenBook }: ListingPreviewModalProps) => {
  if (!item) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.center} pointerEvents="box-none">
        <View style={styles.panel} testID="listing-preview">
          <Text style={styles.heading}>Your post</Text>
          <Text style={styles.sub}>This is how readers see it in the Feed.</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            <ListingCard
              item={item}
              onOpenBook={onOpenBook}
              onOpenOwner={noop}
              onRequestMeetup={noop}
              onSave={noop}
              onEdit={onEdit}
            />
          </ScrollView>
          <AppButton variant="secondary" label="Close" onPress={onClose} style={styles.close} />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  scrim: { ...(StyleSheet.absoluteFill as object), backgroundColor: colors.scrim },
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: 16 },
  panel: { maxHeight: '88%', backgroundColor: colors.cream, borderRadius: 28, padding: 16, gap: 8 },
  heading: { fontSize: 20, fontWeight: '900', color: colors.ink },
  sub: { fontSize: 13, color: colors.muted, marginBottom: 4 },
  close: { marginTop: 8 },
});

export default ListingPreviewModal;
