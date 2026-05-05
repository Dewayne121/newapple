// ---------------------------------------------------------------------------
// Event Taxonomy — strict schema definitions for internal analytics
// ---------------------------------------------------------------------------
// Naming rules:
//   • snake_case
//   • past tense for actions (user_signed_up, purchase_completed)
//   • noun_phrase for views (screen_viewed, profile_viewed)
//   • Group by category using EVENT_CATEGORIES
// ---------------------------------------------------------------------------

export const EVENT_CATEGORIES = {
  AUTH: 'auth',
  NAVIGATION: 'navigation',
  WORKOUTS: 'workouts',
  CHALLENGES: 'challenges',
  LEADERBOARDS: 'leaderboards',
  SOCIAL: 'social',
  MONETIZATION: 'monetization',
  NOTIFICATIONS: 'notifications',
  ERRORS: 'errors',
  ONBOARDING: 'onboarding',
  SYSTEM: 'system',
};

// Consent category per event category
export const CATEGORY_CONSENT = {
  auth: 'essential',
  navigation: 'analytics',
  workouts: 'analytics',
  challenges: 'analytics',
  leaderboards: 'analytics',
  social: 'analytics',
  monetization: 'analytics',
  notifications: 'essential',
  errors: 'essential',
  onboarding: 'essential',
  system: 'essential',
};

export const ANALYTICS_EVENTS = {
  // ── AUTH ──
  user_signed_up: {
    name: 'user_signed_up',
    required: ['method'],
    optional: ['username', 'invite_code_used'],
    description: 'User completed registration',
    version: 1,
    category: EVENT_CATEGORIES.AUTH,
  },
  user_signed_in: {
    name: 'user_signed_in',
    required: ['method'],
    optional: ['is_new_user'],
    description: 'User authenticated',
    version: 1,
    category: EVENT_CATEGORIES.AUTH,
  },
  user_signed_out: {
    name: 'user_signed_out',
    required: [],
    optional: ['session_duration_seconds'],
    description: 'User signed out',
    version: 1,
    category: EVENT_CATEGORIES.AUTH,
  },
  user_deleted_account: {
    name: 'user_deleted_account',
    required: ['reason'],
    optional: ['account_age_days'],
    description: 'User deleted their account',
    version: 1,
    category: EVENT_CATEGORIES.AUTH,
  },

  // ── NAVIGATION ──
  screen_viewed: {
    name: 'screen_viewed',
    required: ['screen_name'],
    optional: ['previous_screen', 'tab_name', 'is_modal'],
    description: 'User navigated to a screen',
    version: 1,
    category: EVENT_CATEGORIES.NAVIGATION,
  },

  // ── WORKOUTS ──
  workout_started: {
    name: 'workout_started',
    required: ['exercise_id', 'exercise_name'],
    optional: [],
    description: 'User began a workout submission',
    version: 1,
    category: EVENT_CATEGORIES.WORKOUTS,
  },
  workout_completed: {
    name: 'workout_completed',
    required: ['exercise_id', 'exercise_name', 'reps', 'weight_kg'],
    optional: ['points', 'strength_ratio', 'video_duration_seconds', 'has_video'],
    description: 'Workout submission completed',
    version: 1,
    category: EVENT_CATEGORIES.WORKOUTS,
  },
  workout_deleted: {
    name: 'workout_deleted',
    required: ['workout_id'],
    optional: ['exercise_name'],
    description: 'User deleted a workout log',
    version: 1,
    category: EVENT_CATEGORIES.WORKOUTS,
  },
  workout_video_uploaded: {
    name: 'workout_video_uploaded',
    required: ['video_id', 'exercise_name'],
    optional: ['duration_seconds', 'file_size_bytes', 'upload_duration_ms'],
    description: 'Workout video uploaded successfully',
    version: 1,
    category: EVENT_CATEGORIES.WORKOUTS,
  },

  // ── CHALLENGES ──
  challenge_viewed: {
    name: 'challenge_viewed',
    required: ['challenge_id'],
    optional: ['challenge_type', 'exercise_name'],
    description: 'User opened a challenge detail',
    version: 1,
    category: EVENT_CATEGORIES.CHALLENGES,
  },
  challenge_joined: {
    name: 'challenge_joined',
    required: ['challenge_id'],
    optional: ['challenge_type', 'is_paid'],
    description: 'User joined a challenge',
    version: 1,
    category: EVENT_CATEGORIES.CHALLENGES,
  },
  challenge_left: {
    name: 'challenge_left',
    required: ['challenge_id'],
    optional: ['reason'],
    description: 'User left a challenge',
    version: 1,
    category: EVENT_CATEGORIES.CHALLENGES,
  },
  challenge_submitted: {
    name: 'challenge_submitted',
    required: ['challenge_id', 'exercise_id'],
    optional: ['reps', 'weight_kg', 'attempt_number', 'video_duration_seconds'],
    description: 'User submitted a challenge entry',
    version: 1,
    category: EVENT_CATEGORIES.CHALLENGES,
  },
  challenge_completed: {
    name: 'challenge_completed',
    required: ['challenge_id', 'final_rank'],
    optional: ['total_submissions', 'points_earned'],
    description: 'Challenge ended and user received final rank',
    version: 1,
    category: EVENT_CATEGORIES.CHALLENGES,
  },

  // ── LEADERBOARDS ──
  leaderboard_viewed: {
    name: 'leaderboard_viewed',
    required: ['leaderboard_type'],
    optional: ['region', 'weight_class', 'exercise_name'],
    description: 'User viewed a leaderboard',
    version: 1,
    category: EVENT_CATEGORIES.LEADERBOARDS,
  },
  core_lift_submitted: {
    name: 'core_lift_submitted',
    required: ['lift_id', 'lift_name', 'weight_kg', 'reps'],
    optional: ['is_personal_best'],
    description: 'User submitted a core lift entry',
    version: 1,
    category: EVENT_CATEGORIES.LEADERBOARDS,
  },

  // ── SOCIAL ──
  profile_viewed: {
    name: 'profile_viewed',
    required: ['viewed_user_id'],
    optional: ['viewed_username', 'source'],
    description: 'User viewed a profile',
    version: 1,
    category: EVENT_CATEGORIES.SOCIAL,
  },
  profile_updated: {
    name: 'profile_updated',
    required: ['fields_changed'],
    optional: [],
    description: 'User updated their profile',
    version: 1,
    category: EVENT_CATEGORIES.SOCIAL,
  },

  // ── MONETIZATION ──
  purchase_started: {
    name: 'purchase_started',
    required: ['product_id', 'product_type', 'price', 'currency'],
    optional: ['sku'],
    description: 'User initiated a purchase',
    version: 1,
    category: EVENT_CATEGORIES.MONETIZATION,
  },
  purchase_completed: {
    name: 'purchase_completed',
    required: ['product_id', 'product_type', 'price', 'currency', 'transaction_id'],
    optional: ['sku', 'is_dev_fallback'],
    description: 'Purchase completed successfully',
    version: 1,
    category: EVENT_CATEGORIES.MONETIZATION,
  },
  purchase_failed: {
    name: 'purchase_failed',
    required: ['product_id', 'product_type', 'error_message'],
    optional: ['error_code'],
    description: 'Purchase failed',
    version: 1,
    category: EVENT_CATEGORIES.MONETIZATION,
  },
  purchase_cancelled: {
    name: 'purchase_cancelled',
    required: ['product_id', 'product_type'],
    optional: [],
    description: 'User cancelled a purchase',
    version: 1,
    category: EVENT_CATEGORIES.MONETIZATION,
  },
  frame_equipped: {
    name: 'frame_equipped',
    required: ['frame_id', 'frame_name'],
    optional: ['was_purchased'],
    description: 'User equipped a profile frame',
    version: 1,
    category: EVENT_CATEGORIES.MONETIZATION,
  },
  rank_highlight_purchased: {
    name: 'rank_highlight_purchased',
    required: [],
    optional: ['transaction_id', 'expiry_date'],
    description: 'User purchased rank highlight',
    version: 1,
    category: EVENT_CATEGORIES.MONETIZATION,
  },
  xp_boost_activated: {
    name: 'xp_boost_activated',
    required: ['boost_type', 'duration_hours', 'multiplier'],
    optional: ['transaction_id'],
    description: 'User activated an XP boost',
    version: 1,
    category: EVENT_CATEGORIES.MONETIZATION,
  },

  // ── NOTIFICATIONS ──
  push_permission_requested: {
    name: 'push_permission_requested',
    required: [],
    optional: [],
    description: 'Push notification permission requested',
    version: 1,
    category: EVENT_CATEGORIES.NOTIFICATIONS,
  },
  push_permission_granted: {
    name: 'push_permission_granted',
    required: [],
    optional: [],
    description: 'Push notification permission granted',
    version: 1,
    category: EVENT_CATEGORIES.NOTIFICATIONS,
  },
  push_permission_denied: {
    name: 'push_permission_denied',
    required: [],
    optional: [],
    description: 'Push notification permission denied',
    version: 1,
    category: EVENT_CATEGORIES.NOTIFICATIONS,
  },
  notification_opened: {
    name: 'notification_opened',
    required: ['notification_type', 'notification_id'],
    optional: ['time_since_sent_seconds'],
    description: 'User opened a push notification',
    version: 1,
    category: EVENT_CATEGORIES.NOTIFICATIONS,
  },

  // ── ERRORS ──
  error_seen: {
    name: 'error_seen',
    required: ['error_type', 'error_message'],
    optional: ['stack_trace', 'screen_name'],
    description: 'An error was caught',
    version: 1,
    category: EVENT_CATEGORIES.ERRORS,
  },
  api_error: {
    name: 'api_error',
    required: ['endpoint', 'status_code', 'error_message'],
    optional: ['request_method', 'response_body'],
    description: 'API request failed',
    version: 1,
    category: EVENT_CATEGORIES.ERRORS,
  },
  video_upload_failed: {
    name: 'video_upload_failed',
    required: ['exercise_name', 'error_message'],
    optional: ['file_size_bytes', 'error_code'],
    description: 'Video upload failed',
    version: 1,
    category: EVENT_CATEGORIES.ERRORS,
  },

  // ── ONBOARDING ──
  onboarding_started: {
    name: 'onboarding_started',
    required: [],
    optional: ['auth_method'],
    description: 'User began onboarding',
    version: 1,
    category: EVENT_CATEGORIES.ONBOARDING,
  },
  onboarding_step_completed: {
    name: 'onboarding_step_completed',
    required: ['step_name', 'step_index', 'total_steps'],
    optional: ['step_data_keys'],
    description: 'User completed an onboarding step',
    version: 1,
    category: EVENT_CATEGORIES.ONBOARDING,
  },
  onboarding_completed: {
    name: 'onboarding_completed',
    required: ['total_duration_seconds', 'steps_completed'],
    optional: [],
    description: 'User completed all onboarding',
    version: 1,
    category: EVENT_CATEGORIES.ONBOARDING,
  },

  // ── SYSTEM ──
  app_opened: {
    name: 'app_opened',
    required: [],
    optional: ['is_first_open', 'days_since_last_open'],
    description: 'App was opened / brought to foreground',
    version: 1,
    category: EVENT_CATEGORIES.SYSTEM,
  },
  session_started: {
    name: 'session_started',
    required: ['session_id'],
    optional: ['is_returning_user'],
    description: 'New analytics session began',
    version: 1,
    category: EVENT_CATEGORIES.SYSTEM,
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getEventDefinition(name) {
  return ANALYTICS_EVENTS[name] || null;
}

export function getEventCategory(name) {
  const def = ANALYTICS_EVENTS[name];
  return def ? def.category : null;
}

/** Returns the consent level required for this event's category */
export function getEventConsentLevel(name) {
  const cat = getEventCategory(name);
  return CATEGORY_CONSENT[cat] || 'analytics';
}

/** Validate event props against its schema. Warns in __DEV__ only. */
export function validateEvent(name, properties = {}) {
  const def = ANALYTICS_EVENTS[name];
  if (!def) {
    if (__DEV__) console.warn(`[Analytics] Unknown event: "${name}"`);
    return { valid: false, missing: [], unknown: [] };
  }

  const missing = def.required.filter((key) => properties[key] === undefined);
  const known = new Set([...def.required, ...def.optional]);
  const unknown = Object.keys(properties).filter((key) => !known.has(key));

  if (__DEV__) {
    if (missing.length) console.warn(`[Analytics] "${name}" missing required fields: ${missing.join(', ')}`);
    if (unknown.length) console.warn(`[Analytics] "${name}" has unknown fields: ${unknown.join(', ')}`);
  }

  return { valid: missing.length === 0, missing, unknown };
}
