import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  
  Image,
} from 'react-native';
import { dialog } from '../../component/ui/AppDialog';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton, Field } from '../../component/feed/ui';
import { colors } from '../../theme/colors';
import { loginUser } from '../../services/authService';

const LoginScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      dialog.alert('Error', 'Please enter both email and password');
      return;
    }

    try {
      // ✅ JUST CALL LOGIN: App.tsx handles the navigation automatically
      await loginUser(email, password);
      
      // DELETED: navigation.replace('Home'); 
      // Keeping this line is what causes the "Not handled by navigator" error.
      
    } catch {
      let errorMessage = 'Invalid email or password.';
      dialog.alert('Login Failed', errorMessage);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Image source={require('../../assets/logoNoBg.png')} style={styles.logo} resizeMode="contain" />

      <Text style={styles.title}>Welcome back</Text>
      <Text style={styles.subtitle}>Log in to see what readers near you are sharing.</Text>

      <View style={styles.form}>
        <Field
          label="Email"
          placeholder="you@email.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Field label="Password" placeholder="Your password" value={password} onChangeText={setPassword} secureTextEntry />
        <AppButton label="Log in" onPress={handleLogin} style={styles.submit} />
      </View>

      <TouchableOpacity style={styles.footer} onPress={() => navigation.navigate('Register')}>
        <Text style={styles.footerText}>
          New to TaleTrade? <Text style={styles.footerLink}>Create account</Text>
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 24 },
  logo: { width: 150, height: 150, alignSelf: 'center' },
  title: { fontSize: 32, fontWeight: '900', color: colors.heading },
  subtitle: { fontSize: 15, color: colors.muted, marginTop: 6, lineHeight: 22 },
  form: { marginTop: 24, gap: 16 },
  submit: { marginTop: 8 },
  footer: { marginTop: 'auto', paddingTop: 24, alignItems: 'center' },
  footerText: { fontSize: 14, fontWeight: '500', color: colors.body },
  footerLink: { fontWeight: '700', color: colors.primary },
});

export default LoginScreen;