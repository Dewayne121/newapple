import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { SKINS } from '../constants/colors';

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const {
    signInWithEmail,
    signUpWithEmail,
    signInWithApple,
    appleAuthAvailable,
    loading,
  } = useAuth();

  const [mode, setMode] = useState('signin');
  const [authType, setAuthType] = useState('options');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [localError, setLocalError] = useState('');

  const handleEmailAuth = async () => {
    setLocalError('');

    if (!email || !password) {
      setLocalError('Please fill in all fields');
      return;
    }

    if (mode === 'signup' && !username) {
      setLocalError('Please enter a username');
      return;
    }

    if (mode === 'signup') {
      if (!inviteCode.trim()) {
        setLocalError('Invite code is required');
        return;
      }
      if (username.length < 3 || username.length > 20) {
        setLocalError('Username must be 3-20 characters');
        return;
      }
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        setLocalError('Username can only contain letters, numbers, and underscores');
        return;
      }
    }

    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters');
      return;
    }

    let result;
    if (mode === 'signin') {
      result = await signInWithEmail(email, password);
    } else {
      result = await signUpWithEmail(email, password, username, inviteCode.trim().toUpperCase());
    }

    if (!result?.success) {
      setLocalError(result?.error || 'Authentication failed');
    }
  };

  const handleAppleSignIn = async () => {
    setLocalError('');
    const result = await signInWithApple();
    if (!result?.success) {
      setLocalError(result?.error || 'Apple sign-in failed');
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 20 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo / Branding */}
          <View style={styles.branding}>
            <Image source={require('../../assets/logo.png')} style={styles.logoImage} resizeMode="contain" />
            <Text style={styles.tagline}>Compete. Conquer. Repeat.</Text>
          </View>

          {/* Auth Options */}
          {authType === 'options' && (
            <View style={styles.authCard}>
              <Text style={styles.authTitle}>Enter the Arena</Text>
              <Text style={styles.authSubtitle}>
                Choose your path to dominance
              </Text>

              {/* Email Sign In */}
              <TouchableOpacity
                onPress={() => {
                  setMode('signin');
                  setAuthType('email');
                }}
                activeOpacity={0.9}
                style={styles.emailButton}
              >
                <Ionicons name="mail" size={20} color="#fff" style={styles.socialIcon} />
                <Text style={styles.emailButtonText}>
                  Continue with Email
                </Text>
              </TouchableOpacity>

              {/* Apple Sign In */}
              {appleAuthAvailable && (
              <TouchableOpacity
                onPress={handleAppleSignIn}
                disabled={loading}
                activeOpacity={0.9}
                style={styles.appleButton}
              >
                {loading ? (
                  <View style={styles.buttonContent}>
                    <ActivityIndicator color="#fff" />
                  </View>
                ) : (
                  <>
                    <Ionicons name="logo-apple" size={20} color="#fff" style={styles.socialIcon} />
                    <Text style={styles.appleButtonText}>Continue with Apple</Text>
                  </>
                )}
              </TouchableOpacity>
              )}
            </View>
          )}

          {/* Email Auth */}
          {authType === 'email' && (
            <View style={styles.authCard}>
              {/* Back button row */}
              <TouchableOpacity
                onPress={() => setAuthType('options')}
                style={styles.backButton}
              >
                <Ionicons name="arrow-back" size={24} color="#fafafa" />
              </TouchableOpacity>

              <View style={{ marginTop: 16 }}>
                <Text style={styles.authTitle}>
                  {mode === 'signin' ? 'Welcome Back' : 'Join UNYIELD'}
                </Text>
                <Text style={styles.authSubtitle}>
                  {mode === 'signin' ? 'Sign in to continue' : 'Create your account with an invite code'}
                </Text>
              </View>

              <View style={styles.inputContainer}>
                {mode === 'signup' && (
                  <View style={styles.inputWrapper}>
                    <Ionicons name="at-outline" size={20} color="#a1a1aa" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Username (@handle for login)"
                      placeholderTextColor="#a1a1aa"
                      value={username}
                      onChangeText={setUsername}
                      autoCapitalize="none"
                      autoCorrect={false}
                      maxLength={20}
                    />
                  </View>
                )}
                {mode === 'signup' && (
                  <View style={styles.inputWrapper}>
                    <Ionicons name="ticket-outline" size={20} color="#a1a1aa" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Invite Code"
                      placeholderTextColor="#a1a1aa"
                      value={inviteCode}
                      onChangeText={(text) => setInviteCode(text.replace(/\s+/g, '').toUpperCase())}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={16}
                    />
                  </View>
                )}
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={20} color="#a1a1aa" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder={mode === 'signin' ? 'Email or Username' : 'Email'}
                    placeholderTextColor="#a1a1aa"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType={mode === 'signin' ? 'default' : 'email-address'}
                    textContentType={mode === 'signin' ? 'username' : 'emailAddress'}
                    autoCorrect={false}
                  />
                </View>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={20} color="#a1a1aa" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor="#a1a1aa"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    textContentType="password"
                    autoCorrect={false}
                  />
                </View>

                {/* Error inside form */}
                {localError ? (
                  <View style={styles.errorContainer}>
                    <Ionicons name="warning-outline" size={16} color="#ff2d55" />
                    <Text style={styles.errorText}>{localError}</Text>
                    <TouchableOpacity onPress={() => setLocalError('')}>
                      <Ionicons name="close-circle" size={16} color="#ff2d55" />
                    </TouchableOpacity>
                  </View>
                ) : null}

                <TouchableOpacity
                  onPress={handleEmailAuth}
                  disabled={loading}
                  activeOpacity={0.85}
                  style={styles.primaryButton}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      {mode === 'signin' ? 'Sign In' : 'Create Account'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.switchContainer}>
                <Text style={styles.switchText}>
                  {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
                </Text>
                <TouchableOpacity onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
                  <Text style={styles.switchLink}>
                    {mode === 'signin' ? 'Sign Up' : 'Sign In'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Error Message for options screen */}
          {authType === 'options' && localError ? (
            <View style={styles.errorContainer}>
              <Ionicons name="warning-outline" size={16} color="#ff2d55" />
              <Text style={styles.errorText}>{localError}</Text>
              <TouchableOpacity onPress={() => setLocalError('')}>
                <Ionicons name="close-circle" size={16} color="#ff2d55" />
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Terms */}
          <Text style={styles.terms}>
            By continuing, you agree to our Terms of Service and Privacy Policy
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  contentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  branding: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoImage: {
    width: 120,
    height: 120,
    marginBottom: 16,
  },
  tagline: {
    fontSize: 14,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontWeight: '700',
    fontFamily: 'SpaceGroteskBold',
    color: '#a1a1aa',
  },
  authCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#27272a',
    backgroundColor: '#121214',
    padding: 24,
    marginBottom: 20,
  },
  authTitle: {
    fontSize: 22,
    fontWeight: '900',
    fontFamily: 'SpaceGroteskBold',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 1,
    color: '#fafafa',
  },
  authSubtitle: {
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 24,
    fontWeight: '700',
    fontFamily: 'SpaceGroteskSemiBold',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: '#a1a1aa',
  },
  // Email button
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    backgroundColor: '#ff2d55',
    marginBottom: 12,
    shadowColor: '#ff2d55',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  emailButtonText: {
    fontSize: 14,
    fontWeight: '900',
    fontFamily: 'SpaceGroteskBold',
    letterSpacing: 1,
    color: '#fff',
  },
  // Apple button
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#27272a',
    backgroundColor: '#18181b',
  },
  appleButtonText: {
    fontSize: 14,
    fontWeight: '900',
    fontFamily: 'SpaceGroteskBold',
    letterSpacing: 1,
    color: '#ffffff',
  },
  socialIcon: {
    position: 'absolute',
    left: 24,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  inputContainer: {
    marginTop: 20,
    gap: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#27272a',
    backgroundColor: '#18181b',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    fontFamily: 'SpaceGrotesk',
    color: '#fafafa',
  },
  primaryButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: '#ff2d55',
    shadowColor: '#ff2d55',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '900',
    fontFamily: 'SpaceGroteskBold',
    letterSpacing: 1.5,
    color: '#fff',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  switchText: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk',
    color: '#a1a1aa',
  },
  switchLink: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'SpaceGroteskSemiBold',
    color: '#ff2d55',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,45,85,0.3)',
    backgroundColor: 'rgba(255,45,85,0.08)',
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'SpaceGroteskSemiBold',
    color: '#ff2d55',
    flex: 1,
  },
  terms: {
    fontSize: 11,
    textAlign: 'center',
    paddingHorizontal: 20,
    fontFamily: 'SpaceGrotesk',
    color: '#a1a1aa',
  },
});
