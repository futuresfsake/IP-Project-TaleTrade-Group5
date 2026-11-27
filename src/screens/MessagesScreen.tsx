// Messages tab: placeholder until chat is built (see BACKLOG.md).
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageCircle } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { AppButton, EmptyState, ScreenHeader } from '../component/feed/ui';

const MessagesScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Messages" subtitle="Chat with other readers" />
      <EmptyState
        icon={<MessageCircle color={colors.purple} size={48} strokeWidth={1.8} />}
        title="Messaging is coming soon"
        body="Until then, open a reader’s profile from the Feed and use their contact link."
      >
        <AppButton label="Go to the Feed" onPress={() => navigation.navigate('Feed')} />
      </EmptyState>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
});

export default MessagesScreen;
