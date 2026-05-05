import { analyticsEngine } from '../services/analyticsEngine';

// ---------------------------------------------------------------------------
// Analytics facade — preserves the existing API surface while delegating
// to the new analyticsEngine. Existing call sites (AppNavigator, etc.)
// continue to work without changes.
// ---------------------------------------------------------------------------

export const Analytics = {
  init: () => analyticsEngine.init(),

  identify: (userId, properties = {}) => analyticsEngine.identify(userId, properties),

  logEvent: (name, properties = {}) => analyticsEngine.track(name, properties),

  logScreenView: (screenName) => analyticsEngine.screenView(screenName),

  setUserProperty: (key, value) => analyticsEngine.setUserProperty(key, value),

  reset: () => analyticsEngine.reset(),

  // Convenience methods — map to taxonomy events
  logLogin: (method) => analyticsEngine.track('user_signed_in', { method }),

  logSignUp: (method) => analyticsEngine.track('user_signed_up', { method }),

  logWorkoutCompleted: (params = {}) => analyticsEngine.track('workout_completed', params),

  logChallengeJoined: (challengeId) => analyticsEngine.track('challenge_joined', { challenge_id: challengeId }),

  logChallengeSubmitted: (challengeId) => analyticsEngine.track('challenge_submitted', { challenge_id: challengeId }),
};
