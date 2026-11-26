import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { Home, User, Book, Rss, MessageCircle } from 'lucide-react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const { width } = Dimensions.get('window');

const COLORS = {
  primary: '#6C63A8',
  softPurple: '#7E6FB0',
  creamBg: '#F5E9CF',
  white: '#FFFFFF',
};

const TabBar = ({ state, descriptors, navigation }: BottomTabBarProps) => {
  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];

          const label = options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : route.name;

          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const renderIcon = (color: string) => {
            const iconProps = {
              color,
              size: 22,
              strokeWidth: isFocused ? 2.5 : 2
            };

            switch (route.name) {
              case 'Home':
                return <Home {...iconProps} />;
              case 'Feed':
                return <Rss {...iconProps} />;
              case 'Messages':
                return <MessageCircle {...iconProps} />;
              case 'Library':
                return <Book {...iconProps} />;
              case 'Profile':
                return <User {...iconProps} />;
              default:
                return <Home {...iconProps} />;
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              onPress={onPress}
              activeOpacity={0.7}
              style={[
                styles.tabItem,
                isFocused && styles.activeTabItem
              ]}
            >
              {renderIcon(isFocused ? COLORS.primary : COLORS.softPurple)}

              {isFocused && (
                <Text style={styles.label}>
                  {typeof label === 'string' ? label : route.name}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

// Styles remain the same
const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 34 : 20,
    width: width,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  container: {
    flexDirection: 'row',
    backgroundColor: COLORS.creamBg,
    width: width * 0.92, // Room for five tabs
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 35,
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: COLORS.softPurple,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 45,
    paddingHorizontal: 8,
    borderRadius: 25,
  },
  activeTabItem: {
    backgroundColor: COLORS.white,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  label: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
});

export default TabBar;