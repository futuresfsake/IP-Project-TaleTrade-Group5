// Dropdown menu anchored to the button that opened it (used by the Library's ⋯ button).
import React from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../theme/colors';

export interface MenuItem {
  label: string;
  icon: React.ReactNode;
  destructive?: boolean;
  onPress: () => void;
}

/** Window coordinates of the anchor button, from `measureInWindow`. */
export interface MenuAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

const ITEM_HEIGHT = 48;
const PADDING = 6;
// Keeps the menu above the floating tab bar.
const BOTTOM_SAFE = 110;

interface ActionMenuProps {
  anchor: MenuAnchor | null;
  items: MenuItem[];
  onClose: () => void;
}

const ActionMenu = ({ anchor, items, onClose }: ActionMenuProps) => {
  if (!anchor) return null;
  const screen = Dimensions.get('window');
  const height = items.length * ITEM_HEIGHT + PADDING * 2;
  const below = anchor.y + anchor.height + 4;
  // Open upwards when there is no room underneath.
  const top = below + height > screen.height - BOTTOM_SAFE ? anchor.y - height - 4 : below;
  const right = Math.max(12, screen.width - (anchor.x + anchor.width));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close menu" />
      <View style={[styles.menu, { top, right }]} accessibilityRole="menu">
        {items.map(item => (
          <TouchableOpacity
            key={item.label}
            accessibilityRole="menuitem"
            style={styles.item}
            onPress={() => {
              onClose();
              item.onPress();
            }}
          >
            {item.icon}
            <Text style={[styles.label, item.destructive && styles.danger]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  menu: {
    position: 'absolute',
    minWidth: 200,
    paddingVertical: PADDING,
    borderRadius: 18,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.ink,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, height: ITEM_HEIGHT, paddingHorizontal: 16 },
  label: { fontSize: 15, fontWeight: '600', color: colors.ink },
  danger: { color: colors.danger },
});

export default ActionMenu;
