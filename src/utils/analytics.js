import { Platform } from 'react-native';

// Web implementation uses Firebase JS SDK
// Native implementation uses @react-native-firebase/analytics

const firebaseConfig = {
  apiKey: 'AIzaSyArVizsGkT-v5Sn1XoKdi1rze3LsY1eyk0',
  authDomain: 'unyield-c057b.firebaseapp.com',
  projectId: 'unyield-c057b',
  storageBucket: 'unyield-c057b.firebasestorage.app',
  messagingSenderId: '676392008620',
  appId: '1:676392008620:ios:cb9c458cf639004d791809',
  measurementId: 'G-XXXXXXXXXX', // TODO: get from Firebase Console > Project Settings > Web App
};

let webAnalytics = null;
let nativeAnalytics = null;

async function getWebAnalytics() {
  if (webAnalytics) return webAnalytics;
  const firebase = await import('firebase/app');
  await import('firebase/analytics');

  if (!firebase.getApps().length) {
    firebase.initializeApp(firebaseConfig);
  }
  webAnalytics = firebase.getAnalytics();
  return webAnalytics;
}

async function getNativeAnalytics() {
  if (nativeAnalytics) return nativeAnalytics;
  const mod = await import('@react-native-firebase/analytics');
  nativeAnalytics = mod.default();
  return nativeAnalytics;
}

const isWeb = Platform.OS === 'web';

export const Analytics = {
  async logEvent(name, params = {}) {
    if (isWeb) {
      const { logEvent } = await import('firebase/analytics');
      const fa = await getWebAnalytics();
      logEvent(fa, name, params);
    } else {
      const a = await getNativeAnalytics();
      a.logEvent(name, params);
    }
  },

  async logScreenView(screenName) {
    if (isWeb) {
      const { logEvent } = await import('firebase/analytics');
      const fa = await getWebAnalytics();
      logEvent(fa, 'screen_view', { screen_name: screenName, screen_class: screenName });
    } else {
      const a = await getNativeAnalytics();
      a.logScreenView({ screen_name: screenName, screen_class: screenName });
    }
  },

  async setUserProperty(key, value) {
    if (isWeb) {
      const { setUserProperties } = await import('firebase/analytics');
      const fa = await getWebAnalytics();
      setUserProperties(fa, { [key]: value });
    } else {
      const a = await getNativeAnalytics();
      a.setUserProperty(key, value);
    }
  },

  async setUserId(id) {
    if (isWeb) {
      const { setUserId } = await import('firebase/analytics');
      const fa = await getWebAnalytics();
      setUserId(fa, id);
    } else {
      const a = await getNativeAnalytics();
      a.setUserId(id);
    }
  },

  async logLogin(method) {
    if (isWeb) {
      const { logEvent } = await import('firebase/analytics');
      const fa = await getWebAnalytics();
      logEvent(fa, 'login', { method });
    } else {
      const a = await getNativeAnalytics();
      a.logLogin({ method });
    }
  },

  async logSignUp(method) {
    if (isWeb) {
      const { logEvent } = await import('firebase/analytics');
      const fa = await getWebAnalytics();
      logEvent(fa, 'sign_up', { method });
    } else {
      const a = await getNativeAnalytics();
      a.logSignUp({ method });
    }
  },

  async logWorkoutCompleted(params = {}) {
    return Analytics.logEvent('workout_completed', params);
  },

  async logChallengeJoined(challengeId) {
    return Analytics.logEvent('challenge_joined', { challenge_id: challengeId });
  },

  async logChallengeSubmitted(challengeId) {
    return Analytics.logEvent('challenge_submitted', { challenge_id: challengeId });
  },
};
