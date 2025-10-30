/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState } from 'react';
import {
  StyleSheet,
  Alert,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function LoginScreen() {
  const [regnumber, setRegnumber] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const API_BASE_URL =
    process.env.EXPO_PUBLIC_API_URL || 'https://fue-vote-backend-1.onrender.com';

  // ✅ Securely store token
  const saveToken = async (token: string) => {
    try {
      await SecureStore.setItemAsync('jwt_token', token);
    } catch (error) {
      console.error('Error saving token:', error);
    }
  };

  // 🔹 Login handler (voter only)
  const login = async () => {
    if (!regnumber.trim()) {
      Alert.alert('Missing Info', 'Please enter your regnumber.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/voter-login`, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ regnumber }), // voter login
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.message || 'Login failed');

      if (data.token) await saveToken(data.token);

      Alert.alert('Login Successful', `Welcome, ${data?.regnumber || regnumber}`);
      router.push('/home');
    } catch (error: any) {
      console.error('Login error:', error);
      Alert.alert('Error', error.message || 'Unable to login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 🔹 Fingerprint login (voter only)
  const handleFingerprintLogin = async () => {
    if (!regnumber.trim()) {
      Alert.alert('Missing Info', 'Please enter your regnumber first.');
      return;
    }

    setLoading(true);
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();

      if (!compatible || !enrolled) {
        Alert.alert('Unavailable', 'Fingerprint authentication not available.');
        setLoading(false);
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access voting system',
      });

      if (!result.success) {
        Alert.alert('Authentication Failed', 'Fingerprint did not match.');
        setLoading(false);
        return;
      }

      // After successful biometric auth, perform voter login
      await login();
    } catch (error: any) {
      console.error('Fingerprint login error:', error);
      Alert.alert('Error', error.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.content}
      >
        <View style={styles.logoContainer}>
          <ThemedText type="title" style={styles.title}>
            FUEZ Smart Voting
          </ThemedText>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Enter Regnumber"
            placeholderTextColor="#807878ff"
            value={regnumber}
            onChangeText={setRegnumber}
          />

          <TouchableOpacity
            style={[styles.button, styles.manualButton]}
            onPress={login}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.buttonContent}>
                <MaterialCommunityIcons name="account" size={22} color="#fff" />
                <ThemedText style={styles.buttonText}>Login</ThemedText>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.fingerprintButton]}
            onPress={handleFingerprintLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.buttonContent}>
                <ThemedText style={styles.buttonText}>Fingerprint login</ThemedText>
                <MaterialCommunityIcons name="fingerprint" size={24} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        </View>

        <ThemedText style={styles.footerText}>
          © {new Date().getFullYear()} FUEZ Student Election
        </ThemedText>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8faff', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  content: { width: '100%', alignItems: 'center' },
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  title: { fontSize: 28, fontWeight: '700', color: '#00aa55' },
  form: { width: '100%', gap: 14 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 16,
    color: '#333',
    elevation: 1,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    elevation: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  manualButton: { backgroundColor: '#00aa55', shadowColor: '#fff' },
  fingerprintButton: { backgroundColor: '#00aa55', shadowColor: '#fff' },
  buttonContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  footerText: { marginTop: 40, color: '#777', fontSize: 12 },
});
