import AsyncStorage from '@react-native-async-storage/async-storage';

// ---------------------------------------------------------------------------
// Consent Manager — UK GDPR / ICO compliant consent state
// ---------------------------------------------------------------------------
const STORAGE_KEY = '@unyield_analytics_consent';
const CONSENT_VERSION = 1;

const DEFAULT_STATE = {
  essential: true,
  analytics: null,     // null = not yet asked
  marketing: null,
  consented_at: null,
  consent_version: CONSENT_VERSION,
};

let _state = null;

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
export async function init() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    _state = raw ? { ...DEFAULT_STATE, ...JSON.parse(raw) } : { ...DEFAULT_STATE };
  } catch {
    _state = { ...DEFAULT_STATE };
  }
}

function _save() {
  if (!_state) return;
  try { AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(_state)); } catch {}
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function getConsentState() {
  if (!_state) return { ...DEFAULT_STATE };
  return { ..._state };
}

export function hasConsent(category) {
  if (!_state) return false;
  if (category === 'essential') return true;
  return _state[category] === true;
}

export function shouldShowBanner() {
  if (!_state) return true;
  return _state.analytics === null;
}

export async function grantAll() {
  if (!_state) _state = { ...DEFAULT_STATE };
  _state.analytics = true;
  _state.marketing = true;
  _state.consented_at = new Date().toISOString();
  _state.consent_version = CONSENT_VERSION;
  _save();
}

export async function denyAll() {
  if (!_state) _state = { ...DEFAULT_STATE };
  _state.analytics = false;
  _state.marketing = false;
  _state.consented_at = new Date().toISOString();
  _state.consent_version = CONSENT_VERSION;
  _save();
}

export async function updateConsent(category, value) {
  if (!_state) _state = { ...DEFAULT_STATE };
  if (category === 'essential') return; // can't change essential
  _state[category] = value;
  _state.consented_at = new Date().toISOString();
  _state.consent_version = CONSENT_VERSION;
  _save();
}

export async function withdrawConsent() {
  if (!_state) _state = { ...DEFAULT_STATE };
  _state.analytics = false;
  _state.marketing = false;
  _state.consented_at = new Date().toISOString();
  _save();
}
