import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme/colors';

const LaunchScreen = ({ navigation }: any) => {
  return (
    <Pressable
      style={styles.container}
      accessibilityRole="button"
      accessibilityLabel="Tap anywhere to continue"
      onPress={() => navigation.replace('Login')}
    >
      <View style={styles.brand}>
        <Image source={require('../assets/logoNoBg.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.tagline}>Trade tales. Meet fellow readers.</Text>
      </View>

      <View style={styles.wave}>
        <Svg height="320" width="100%" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <Path
            fill="#6C63A8"
            d="M0,240 C200,100 500,100 720,240 C850,50 1300,50 1440,120 L1440,320 L0,320 Z"
          />
        </Svg>
      </View>

      <Text style={styles.tapText}>Tap anywhere</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E8DDC7' },
  brand: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 160 },
  logo: { width: '85%', height: 280 },
  tagline: { fontSize: 16, fontWeight: '500', color: colors.body },
  wave: { position: 'absolute', bottom: 0, width: '100%' },
  tapText: { position: 'absolute', alignSelf: 'center', bottom: 48, color: colors.white, fontSize: 14, fontWeight: '600' },
});

export default LaunchScreen;
