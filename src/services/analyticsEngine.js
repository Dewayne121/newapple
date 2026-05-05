import { Platform, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as consentManager from './consentManager';
import { getEventCategory, getEventConsentLevel, validateEvent, EVENT_CATEGORIES } from '../constants/analyticsEvents';

// ---------------------------------------------------------------------------
// Analytics Engine — client SDK with batching, offline queue, sessions,
// context enrichment, consent gating, rate limiting, dual destination
// ---------------------------------------------------------------------------

const QUEUE_KEY = '@unyield_analytics_queue';
const SESSION_KEY = '@unyield_analytics_session';
const ANON_ID_KEY = '@unyield_analytics_anon_id';
const EVENT_COUNT_KEY = '@unyield_analytics_event_count';

const BATCH_SIZE = 20;
const FLUSH_INTERVAL_MS = 30_000;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const MAX_QUEUE_SIZE = 500;
const MAX_EVENTS_PER_SESSION = 100;

let _userId = null;
let _userProperties = {};
let _anonymousId = null;
let _sessionId = null;
let _sessionStartedAt = null;
let _lastActivityAt = null;
let _eventCount = 0;

const _eventQueue = [];
const _seenEventIds = new Set();
let _flushTimer = null;
let _mixpanel = null;
let _apiModule = null;

// ---------------------------------------------------------------------------
// UUID — lightweight, no external dependency
// ---------------------------------------------------------------------------
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ---------------------------------------------------------------------------
// Context enrichment
// ---------------------------------------------------------------------------
function buildContext() {
  const expoConfig = Constants?.expoConfig || {};

  let locale = 'en-GB';
  let timezone = 'Europe/London';
  try {
    const fmt = Intl?.DateTimeFormat?.();
    if (fmt) {
      locale = fmt.resolvedOptions?.().locale || locale;
      timezone = fmt.resolvedOptions?.().timeZone || timezone;
    }
  } catch {}

  return {
    app_version: expoConfig.version || '1.0.0',
    platform: Platform.OS,
    device_type: Platform.isPad ? 'tablet' : 'phone',
    os_version: String(Platform.Version || ''),
    session_id: _sessionId,
    anonymous_id: _anonymousId,
    user_id: _userId,
    locale,
    timezone,
    consent_state: consentManager.getConsentState(),
    timestamp: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------
async function _loadOrCreateSession() {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (raw) {
      const stored = JSON.parse(raw);
      const now = Date.now();
      // Resume if within timeout
      if (stored.last_activity_at && (now - stored.last_activity_at) < SESSION_TIMEOUT_MS) {
        _sessionId = stored.session_id;
        _sessionStartedAt = stored.started_at;
        _lastActivityAt = stored.last_activity_at;
        return;
      }
    }
  } catch {}

  // New session
  _sessionId = uuid();
  _sessionStartedAt = new Date().toISOString();
  _lastActivityAt = Date.now();
  _eventCount = 0;
  await _saveSession();
  await AsyncStorage.setItem(EVENT_COUNT_KEY, '0');
}

async function _saveSession() {
  try {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({
      session_id: _sessionId,
      started_at: _sessionStartedAt,
      last_activity_at: _lastActivityAt,
    }));
  } catch {}
}

async function _ensureAnonId() {
  if (_anonymousId) return;
  try {
    const stored = await AsyncStorage.getItem(ANON_ID_KEY);
    if (stored) {
      _anonymousId = stored;
    } else {
      _anonymousId = uuid();
      await AsyncStorage.setItem(ANON_ID_KEY, _anonymousId);
    }
  } catch {
    _anonymousId = uuid();
  }
}

async function _loadEventCount() {
  try {
    const raw = await AsyncStorage.getItem(EVENT_COUNT_KEY);
    _eventCount = raw ? parseInt(raw, 10) : 0;
  } catch {
    _eventCount = 0;
  }
}

async function _incrementEventCount() {
  _eventCount++;
  try { await AsyncStorage.setItem(EVENT_COUNT_KEY, String(_eventCount)); } catch {}
}

// ---------------------------------------------------------------------------
// Offline queue persistence
// ---------------------------------------------------------------------------
async function _loadPersistedQueue() {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (raw) {
      const stored = JSON.parse(raw);
      if (Array.isArray(stored)) {
        stored.forEach((e) => _eventQueue.push(e));
      }
    }
  } catch {}
}

async function _persistQueue() {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(_eventQueue));
  } catch {}
}

async function _clearPersistedQueue() {
  try { await AsyncStorage.removeItem(QUEUE_KEY); } catch {}
}

// ---------------------------------------------------------------------------
// Flush — send batch to backend + Mixpanel
// ---------------------------------------------------------------------------
async function _flush() {
  if (_eventQueue.length === 0) return;

  const batch = _eventQueue.splice(0, BATCH_SIZE);
  await _persistQueue(); // save remaining

  // Dual destination
  const promises = [];

  // Backend
  if (_apiModule) {
    promises.push(
      _apiModule.trackBatch(batch).catch(() => {
        // Re-queue on failure
        _eventQueue.unshift(...batch);
        _persistQueue();
      })
    );
  }

  // Mixpanel forward (only if analytics consent)
  if (_mixpanel && consentManager.hasConsent('analytics')) {
    for (const event of batch) {
      try {
        const { event: _name, _context, ...props } = event;
        _mixpanel.track(_name, props);
      } catch {}
    }
  }

  await Promise.allSettled(promises);

  // If queue drained, clear persisted
  if (_eventQueue.length === 0) {
    await _clearPersistedQueue();
  }
}

function _startFlushTimer() {
  if (_flushTimer) clearInterval(_flushTimer);
  _flushTimer = setInterval(() => _flush(), FLUSH_INTERVAL_MS);
}

// ---------------------------------------------------------------------------
// AppState listener
// ---------------------------------------------------------------------------
function _handleAppState(state) {
  if (state === 'background') {
    _flush(); // fire and forget
  } else if (state === 'active') {
    // Check session timeout
    if (_lastActivityAt && (Date.now() - _lastActivityAt) > SESSION_TIMEOUT_MS) {
      _sessionId = uuid();
      _sessionStartedAt = new Date().toISOString();
      _eventCount = 0;
      _saveSession();
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

class AnalyticsEngine {
  async init() {
    // Load lazy dependencies
    try {
      const api = require('./api');
      _apiModule = api.default || api;
    } catch {}

    try {
      const mp = require('mixpanel-react-native');
      if (mp?.Mixpanel) {
        _mixpanel = new mp.Mixpanel('348746f778ca43cfa2ce53fce9551544');
        await _mixpanel.init();
        if (consentManager.hasConsent('analytics')) {
          _mixpanel.optInTracking();
        }
      }
    } catch {}

    await _ensureAnonId();
    await _loadOrCreateSession();
    await _loadEventCount();
    await _loadPersistedQueue();

    // Trim queue if over max
    if (_eventQueue.length > MAX_QUEUE_SIZE) {
      _eventQueue.splice(0, _eventQueue.length - MAX_QUEUE_SIZE);
      await _persistQueue();
    }

    AppState.addEventListener('change', _handleAppState);
    _startFlushTimer();

    // Flush any persisted offline events
    if (_eventQueue.length > 0) {
      _flush();
    }
  }

  async track(eventName, properties = {}) {
    // Consent check
    const consentLevel = getEventConsentLevel(eventName);
    if (consentLevel !== 'essential' && !consentManager.hasConsent(consentLevel)) {
      return;
    }

    // Rate limit
    if (_eventCount >= MAX_EVENTS_PER_SESSION) {
      if (__DEV__ && _eventCount === MAX_EVENTS_PER_SESSION) {
        console.warn('[Analytics] Session event limit reached, dropping events');
      }
      return;
    }

    // Validate (dev only warnings)
    if (__DEV__) validateEvent(eventName, properties);

    // Build event
    const eventId = uuid();
    if (_seenEventIds.has(eventId)) return; // dedup
    _seenEventIds.add(eventId);

    const event = {
      event: eventName,
      ...properties,
      _context: {
        ...buildContext(),
        event_id: eventId,
      },
    };

    _eventQueue.push(event);
    _lastActivityAt = Date.now();
    _saveSession();
    await _incrementEventCount();

    // Auto-flush at batch size
    if (_eventQueue.length >= BATCH_SIZE) {
      _flush();
    }
  }

  async identify(userId, properties = {}) {
    _userId = userId;
    if (properties) _userProperties = { ..._userProperties, ...properties };

    // Mixpanel identify
    if (_mixpanel && consentManager.hasConsent('analytics')) {
      try {
        _mixpanel.identify(userId);
        if (Object.keys(properties).length > 0) {
          _mixpanel.getPeople().set(properties);
        }
      } catch {}
    }
  }

  async reset() {
    _userId = null;
    _userProperties = {};

    if (_mixpanel) {
      try { _mixpanel.reset(); } catch {}
    }
  }

  async setUserProperty(key, value) {
    _userProperties[key] = value;
    if (_mixpanel && consentManager.hasConsent('analytics')) {
      try { _mixpanel.getPeople().set({ [key]: value }); } catch {}
    }
  }

  async screenView(screenName, extra = {}) {
    return this.track('screen_viewed', { screen_name: screenName, ...extra });
  }

  async flush() {
    return _flush();
  }

  getSessionId() {
    return _sessionId;
  }

  getSessionEventCount() {
    return _eventCount;
  }
}

export const analyticsEngine = new AnalyticsEngine();
