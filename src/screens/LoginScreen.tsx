import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../constants/colors';

export default function LoginScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [email, setEmail]     = useState('');
  const [otp, setOtp]         = useState('');
  const [step, setStep]       = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);

  async function handleSendOtp() {
    if (!email.trim()) {
      Alert.alert('Enter your email', 'Please enter your SyndicSage email address.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false },
      });
      if (error) throw error;
      setStep('otp');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (otp.trim().length < 6) {
      Alert.alert('Enter the code', 'Please enter the code from your email.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otp.trim(),
        type: 'email',
      });
      if (error) throw error;
    } catch (e: any) {
      Alert.alert('Invalid code', e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAppleSignIn() {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken!,
      });
      if (error) Alert.alert('Apple Sign In Error', error.message);
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Error', e.message);
      }
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <View style={styles.logoWrap}>
          <Text style={styles.logoText}>
            Syndic<Text style={styles.logoAccent}>Sage</Text>
          </Text>
          <Text style={styles.logoSub}>VME management, handled with precision</Text>
        </View>

        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={12}
          style={styles.appleBtn}
          onPress={handleAppleSignIn}
        />

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or continue with email</Text>
          <View style={styles.dividerLine} />
        </View>

        {step === 'email' ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor={colors.muted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleSendOtp}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Send sign-in code</Text>
              }
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.otpHint}>
              <Text style={styles.otpHintText}>
                A 6-digit code was sent to{'\n'}
                <Text style={{ fontWeight: '600', color: colors.text }}>{email}</Text>
              </Text>
            </View>
            <TextInput
              style={[styles.input, styles.otpInput]}
              placeholder="00000000"
              placeholderTextColor={colors.muted}
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={8}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleVerifyOtp}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>Verify code</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setStep('email'); setOtp(''); }}>
              <Text style={styles.backText}>← Use a different email</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    inner: { flex: 1, paddingHorizontal: 28, justifyContent: 'center' },
    logoWrap: { alignItems: 'center', marginBottom: 40 },
    logoText: { fontFamily: 'CormorantGaramond_600SemiBold', fontSize: 40, color: colors.text },
    logoAccent: { color: colors.amber },
    logoSub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.muted, marginTop: 6, textAlign: 'center' },
    appleBtn: { width: '100%', height: 50, marginBottom: 20 },
    divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 10 },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
    dividerText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.muted },
    input: {
      fontFamily: 'Inter_400Regular',
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      borderRadius: 12, padding: 14, fontSize: 15, color: colors.text, marginBottom: 12,
    },
    otpInput: { fontFamily: 'Inter_700Bold', fontSize: 26, letterSpacing: 8, textAlign: 'center' },
    otpHint: {
      backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: 10,
      padding: 14, marginBottom: 16,
    },
    otpHintText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 20 },
    btn: {
      backgroundColor: colors.navy, borderRadius: 12, padding: 15,
      alignItems: 'center', marginTop: 4, marginBottom: 16,
    },
    btnDisabled: { opacity: 0.6 },
    btnText: { fontFamily: 'Inter_600SemiBold', color: '#fff', fontSize: 15 },
    backText: { fontFamily: 'Inter_500Medium', textAlign: 'center', fontSize: 13, color: colors.amber2 },
  });
}
