import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { dialog } from '../../component/ui/AppDialog';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { registerUser } from '../../services/authService';
import { AppButton, BackButton, Field } from '../../component/feed/ui';
import { colors } from '../../theme/colors';

const RegisterScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [birthday, setBirthday] = useState('');

  const handleBirthdayChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    let formatted = cleaned;
    if (cleaned.length > 2 && cleaned.length <= 4) {
      formatted = `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`;
    } else if (cleaned.length > 4) {
      formatted = `${cleaned.slice(0, 2)}-${cleaned.slice(2, 4)}-${cleaned.slice(4, 8)}`;
    }
    setBirthday(formatted);
  };

  const handleRegister = async () => {
    if (!email || !username || !birthday || !password || !confirmPassword) {
      dialog.alert('Error', 'Please fill in all fields');
      return;
    }

    const parts = birthday.split('-');
    const month = parseInt(parts[0]);
    const day = parseInt(parts[1]);

    if (month < 1 || month > 12) {
      dialog.alert('Invalid Date', 'Month must be between 01 and 12');
      return;
    }
    if (day < 1 || day > 31) {
      dialog.alert('Invalid Date', 'Day must be between 01 and 31');
      return;
    }
    if (birthday.length < 10) {
      dialog.alert('Invalid Date', 'Use MM-DD-YYYY format');
      return;
    }
    if (password !== confirmPassword) {
      dialog.alert('Error', 'Passwords do not match');
      return;
    }

    try {
      await registerUser(email, password, username, birthday);
      dialog.alert('Success', 'Account created successfully!');
      // navigation.replace('PickAGenre');
    } catch (error: any) {
      dialog.alert('Registration Failed', error.message);
    }
  };

  const goToLogin = () => navigation.popTo('Login');

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <BackButton onPress={() => navigation.goBack()} />
        </View>

        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Join your local book-swapping community.</Text>

        <View style={styles.form}>
          <Field label="Username" placeholder="Username" value={username} onChangeText={setUsername} />
          <Field
            label="Email"
            placeholder="you@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Field
            label="Birthday"
            placeholder="MM-DD-YYYY"
            value={birthday}
            onChangeText={handleBirthdayChange}
            keyboardType="numeric"
            maxLength={10}
          />
          <Field label="Password" placeholder="At least 6 characters" value={password} onChangeText={setPassword} secureTextEntry />
          <Field label="Confirm password" placeholder="Re-enter password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
          <AppButton label="Create account" onPress={handleRegister} style={styles.submit} />
        </View>

        <TouchableOpacity style={styles.footer} onPress={goToLogin}>
          <Text style={styles.footerText}>
            Already have an account? <Text style={styles.footerLink}>Log in</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 24 },
  topBar: { alignItems: 'flex-start', marginBottom: 16 },
  title: { fontSize: 30, fontWeight: '900', color: colors.heading },
  subtitle: { fontSize: 15, color: colors.muted, marginTop: 6 },
  form: { marginTop: 20, gap: 14 },
  submit: { marginTop: 8 },
  footer: { marginTop: 'auto', paddingTop: 24, alignItems: 'center' },
  footerText: { fontSize: 14, fontWeight: '500', color: colors.body },
  footerLink: { fontWeight: '700', color: colors.primary },
});

export default RegisterScreen;