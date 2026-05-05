import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ALL_SKUS } from '../constants/store';
import { Analytics } from '../utils/analytics';

// ---------------------------------------------------------------------------
// react-native-iap — lazy-loaded for native, unavailable on web/Expo Go
// ---------------------------------------------------------------------------
let iap = null;

try {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    iap = require('react-native-iap');
  }
} catch {
  // Native module not available
}

const STORAGE_KEY_PREFIX = 'unyield_purchases_';

let _state = null;
let _currentUserId = null;
let _connected = false;
let _productsLoaded = false;
let _purchaseListener = null;
let _errorListener = null;

// ---------------------------------------------------------------------------
// Default persisted state
// ---------------------------------------------------------------------------
function defaultState() {
  return {
    paidChallengeEntries: {},
    ownedFrames: ['bronze'],
    activeFrame: 'bronze',
    rankHighlightExpiry: null,
    rankHighlightAutoRenew: false,
    extraAttempts: {},
    activeBoost: null,
    transactions: [],
  };
}

function storageKey() {
  return _currentUserId ? `${STORAGE_KEY_PREFIX}${_currentUserId}` : STORAGE_KEY_PREFIX + 'anon';
}

function ensureLoaded() {
  if (!_state) _state = defaultState();
}

async function save() {
  if (!_state) return;
  try {
    await AsyncStorage.setItem(storageKey(), JSON.stringify(_state));
  } catch {}
}

// ---------------------------------------------------------------------------
// Init — call once at app startup
// ---------------------------------------------------------------------------
export async function init() {
  // Load local state (keyed to current user, or anon if not logged in)
  await loadLocalState();

  // Attempt StoreKit connection
  if (!iap) return;

  try {
    _connected = await iap.initConnection();

    if (_connected) {
      try {
        const products = await iap.fetchProducts({ apple: { skus: ALL_SKUS }, type: 'in-app' });
        _productsLoaded = Array.isArray(products) && products.length > 0;
        console.log('[IAP] Products loaded:', _productsLoaded ? products.length : 0);
      } catch (e) {
        console.warn('[IAP] fetchProducts failed:', e.message);
        _productsLoaded = false;
      }

      _purchaseListener = iap.purchaseUpdatedListener(async (purchase) => {
        try {
          await handleIAPPurchase(purchase);
          await iap.finishTransaction({ purchase });
        } catch {}
      });

      _errorListener = iap.purchaseErrorListener((error) => {
        console.warn('IAP purchase error:', error.message);
      });

      try {
        const available = await iap.getAvailablePurchases();
        for (const purchase of available) {
          await handleIAPPurchase(purchase);
          try { await iap.finishTransaction({ purchase }); } catch {}
        }
      } catch {}
    }
  } catch (e) {
    console.warn('IAP init failed:', e.message);
    _connected = false;
  }
}

// ---------------------------------------------------------------------------
// User session — ties purchase state to the logged-in account
// ---------------------------------------------------------------------------
export async function setCurrentUser(userId) {
  const changed = userId !== _currentUserId;
  _currentUserId = userId;
  if (changed) {
    await loadLocalState();
    await syncFromServer();
  }
}

async function loadLocalState() {
  try {
    const raw = await AsyncStorage.getItem(storageKey());
    _state = raw ? { ...defaultState(), ...JSON.parse(raw) } : defaultState();
  } catch {
    _state = defaultState();
  }
}

export async function clearState() {
  _state = defaultState();
  _currentUserId = null;
  try {
    await AsyncStorage.removeItem(storageKey());
  } catch {}
}

async function syncFromServer() {
  if (!_currentUserId) return;
  try {
    const api = require('./api').default || require('./api');
    const res = await api.get('/api/purchases');
    if (res?.purchases) {
      mergeServerState(res.purchases);
      await save();
    }
  } catch {}
}

function mergeServerState(purchases) {
  if (!Array.isArray(purchases)) return;
  ensureLoaded();
  for (const p of purchases) {
    // Only apply server state for items we don't already have
    if (p.sku?.startsWith('com.unyield.frame.') && !_state.ownedFrames.includes(p.sku.split('.').pop())) {
      _state.ownedFrames.push(p.sku.split('.').pop());
    }
    if (p.sku === 'com.unyield.rank_highlight' && p.status === 'completed') {
      if (!_state.rankHighlightExpiry || new Date(p.expires_at) > new Date(_state.rankHighlightExpiry)) {
        _state.rankHighlightExpiry = p.expires_at;
      }
    }
    if (p.sku?.startsWith('com.unyield.xpboost.') && p.status === 'completed') {
      if (!_state.activeBoost || (p.expires_at && new Date(p.expires_at) > new Date(_state.activeBoost.expiresAt))) {
        _state.activeBoost = {
          type: p.sku.includes('1hr') ? '1hr' : '24hr',
          multiplier: 1.5,
          expiresAt: p.expires_at,
        };
      }
    }
    if (p.sku === 'com.unyield.challenge_entry' && p.challenge_id && !_state.paidChallengeEntries[p.challenge_id]) {
      _state.paidChallengeEntries[p.challenge_id] = {
        purchasedAt: p.created_at,
        transactionId: p.id,
      };
    }
    if (p.sku === 'com.unyield.extra_attempt' && p.challenge_id) {
      const cur = _state.extraAttempts[p.challenge_id] || 0;
      _state.extraAttempts[p.challenge_id] = Math.max(cur, p.attempts || 1);
    }
  }
}

// ---------------------------------------------------------------------------
// Shutdown
// ---------------------------------------------------------------------------
export function shutdown() {
  _purchaseListener?.remove();
  _errorListener?.remove();
  if (iap) {
    try { iap.endConnection(); } catch {}
  }
}

// ---------------------------------------------------------------------------
// Map IAP receipt to app state
// ---------------------------------------------------------------------------
async function handleIAPPurchase(purchase) {
  const sku = purchase.productId;
  ensureLoaded();

  const tx = {
    id: purchase.transactionId || `tx_${Date.now()}`,
    sku,
    timestamp: purchase.transactionDate ? new Date(Number(purchase.transactionDate)).toISOString() : new Date().toISOString(),
    status: 'completed',
  };
  _state.transactions.unshift(tx);
  if (_state.transactions.length > 100) _state.transactions = _state.transactions.slice(0, 100);

  applySkuToState(sku);
  await save();
  await recordOnServer(tx.id, sku);
}

function applySkuToState(sku) {
  // Profile frames
  if (sku.startsWith('com.unyield.frame.')) {
    const frameId = sku.split('.').pop();
    if (!_state.ownedFrames.includes(frameId)) {
      _state.ownedFrames.push(frameId);
    }
  }

  // Rank highlight
  if (sku === 'com.unyield.rank_highlight') {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 7);
    _state.rankHighlightExpiry = expiry.toISOString();
    _state.rankHighlightAutoRenew = true;
  }

  // XP boost
  if (sku === 'com.unyield.xpboost.1hr') {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);
    _state.activeBoost = { type: '1hr', multiplier: 1.5, expiresAt: expiresAt.toISOString() };
  }
  if (sku === 'com.unyield.xpboost.24hr') {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    _state.activeBoost = { type: '24hr', multiplier: 1.5, expiresAt: expiresAt.toISOString() };
  }
}

async function recordOnServer(transactionId, sku, extra = {}) {
  try {
    const api = require('./api').default || require('./api');
    await api.post('/api/purchases/record', {
      sku,
      transactionId,
      userId: _currentUserId,
      ...extra,
    });
  } catch {}
}

// ---------------------------------------------------------------------------
// Core purchase — triggers native StoreKit payment sheet
// ---------------------------------------------------------------------------
export async function purchaseSKU(sku) {
  ensureLoaded();

  // ── Real StoreKit path ──
  if (_connected && iap) {
    try {
      const purchase = await iap.requestPurchase({
        apple: { sku },
        type: 'in-app',
      });
      if (purchase) {
        const p = Array.isArray(purchase) ? purchase[0] : purchase;
        if (p) {
          await handleIAPPurchase(p);
          try { await iap.finishTransaction({ purchase: p }); } catch {}
        }
      }
      return { success: true, purchase };
    } catch (error) {
      if (error?.code === 'E_USER_CANCELLED') {
        return { success: false, cancelled: true };
      }
      // StoreKit failed — throw so caller shows the error
      const err = new Error(error?.message || 'Purchase failed');
      err.code = error?.code || 'E_PURCHASE_FAILED';
      throw err;
    }
  }

  // ── StoreKit not connected (web / Expo Go / no native module) ──
  const err = new Error('STORE_UNAVAILABLE');
  err.code = 'STORE_UNAVAILABLE';
  throw err;
}

// ---------------------------------------------------------------------------
// Check if StoreKit is available
// ---------------------------------------------------------------------------
export function isStoreConnected() {
  return _connected;
}

export function areProductsLoaded() {
  return _productsLoaded;
}

// ---------------------------------------------------------------------------
// Feature 1: Paid Weekly Challenges
// ---------------------------------------------------------------------------
export function hasPaidForChallenge(challengeId) {
  ensureLoaded();
  return !!_state.paidChallengeEntries[challengeId];
}

export async function purchaseChallengeEntry(challengeId) {
  ensureLoaded();
  if (_state.paidChallengeEntries[challengeId]) {
    return { success: true, transactionId: 'already_purchased' };
  }
  const result = await purchaseSKU('com.unyield.challenge_entry');
  if (result.success) {
    _state.paidChallengeEntries[challengeId] = {
      purchasedAt: new Date().toISOString(),
      transactionId: result.transactionId || Date.now().toString(36),
    };
    await save();
  }
  return result;
}

// ---------------------------------------------------------------------------
// Feature 2: Profile Frames
// ---------------------------------------------------------------------------
export function getOwnedFrames() {
  ensureLoaded();
  return _state.ownedFrames;
}

export function getActiveFrame() {
  ensureLoaded();
  return _state.activeFrame || 'bronze';
}

export async function setFrameActive(frameId) {
  ensureLoaded();
  if (!_state.ownedFrames.includes(frameId)) return { success: false };
  _state.activeFrame = frameId;
  await save();
  return { success: true };
}

export async function purchaseFrame(frameId, price, sku) {
  ensureLoaded();
  if (_state.ownedFrames.includes(frameId)) {
    return { success: true, transactionId: 'already_owned' };
  }
  if (price === 0 || !sku) {
    // Free frames don't need StoreKit
    _state.ownedFrames.push(frameId);
    await save();
    return { success: true };
  }
  const result = await purchaseSKU(sku);
  if (result.success && !_state.ownedFrames.includes(frameId)) {
    _state.ownedFrames.push(frameId);
    await save();
  }
  return result;
}

// ---------------------------------------------------------------------------
// Feature 3: Rank Highlight
// ---------------------------------------------------------------------------
export function hasRankHighlight() {
  ensureLoaded();
  if (!_state.rankHighlightExpiry) return false;
  return new Date(_state.rankHighlightExpiry) > new Date();
}

export function getRankHighlightExpiry() {
  ensureLoaded();
  return _state.rankHighlightExpiry;
}

export async function purchaseRankHighlight() {
  ensureLoaded();
  const result = await purchaseSKU('com.unyield.rank_highlight');
  if (result.success) {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 7);
    _state.rankHighlightExpiry = expiry.toISOString();
    _state.rankHighlightAutoRenew = true;
    await save();
    Analytics.logEvent('rank_highlight_purchased', {});
  }
  return result;
}

// ---------------------------------------------------------------------------
// Feature 4: Extra Challenge Attempts
// ---------------------------------------------------------------------------
export function getExtraAttempts(challengeId) {
  ensureLoaded();
  return _state.extraAttempts[challengeId] || 0;
}

export function getTotalAttempts(challengeId, freeAttempts = 1) {
  return freeAttempts + getExtraAttempts(challengeId);
}

export async function purchaseExtraAttempt(challengeId) {
  ensureLoaded();
  const result = await purchaseSKU('com.unyield.extra_attempt');
  if (result.success) {
    _state.extraAttempts[challengeId] = (_state.extraAttempts[challengeId] || 0) + 1;
    await save();
  }
  return result;
}

export async function useAttempt(challengeId) {
  ensureLoaded();
  const extra = _state.extraAttempts[challengeId] || 0;
  if (extra > 0) {
    _state.extraAttempts[challengeId] = extra - 1;
    await save();
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Feature 5: XP Boost
// ---------------------------------------------------------------------------
export function getActiveBoost() {
  ensureLoaded();
  if (!_state.activeBoost) return null;
  if (new Date(_state.activeBoost.expiresAt) <= new Date()) {
    _state.activeBoost = null;
    save();
    return null;
  }
  return _state.activeBoost;
}

export function getXPMultiplier() {
  const boost = getActiveBoost();
  return boost ? boost.multiplier : 1.0;
}

export async function purchaseXpBoost(type, price, durationHours, multiplier = 1.5) {
  ensureLoaded();
  const sku = type === '1hr' ? 'com.unyield.xpboost.1hr' : 'com.unyield.xpboost.24hr';
  const result = await purchaseSKU(sku);
  if (result.success) {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + durationHours);
    _state.activeBoost = { type, multiplier, expiresAt: expiresAt.toISOString() };
    await save();
    Analytics.logEvent('xp_boost_activated', { boost_type: type, duration_hours: durationHours, multiplier });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Transactions / State
// ---------------------------------------------------------------------------
export function getTransactions() {
  ensureLoaded();
  return _state.transactions;
}

export function getState() {
  ensureLoaded();
  return _state;
}
