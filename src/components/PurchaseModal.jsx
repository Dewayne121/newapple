import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Analytics } from '../utils/analytics';

// ---------------------------------------------------------------------------
// PurchaseModal — triggers Apple Pay / StoreKit native payment sheet
// ---------------------------------------------------------------------------
export default function PurchaseModal({ visible, onClose, onPurchaseComplete, product, loading: externalLoading }) {
  const [internalLoading, setInternalLoading] = useState(false);
  const [error, setError] = useState(null);
  const isLoading = externalLoading || internalLoading;

  if (!product) return null;

  const handleConfirm = async () => {
    setError(null);
    setInternalLoading(true);
    try {
      Analytics.logEvent('purchase_started', { product_id: product?.name, product_type: 'iap', price: product?.price, currency: 'GBP' });
      await onPurchaseComplete?.();
      Analytics.logEvent('purchase_completed', { product_id: product?.name, product_type: 'iap', price: product?.price, currency: 'GBP', transaction_id: 'completed' });
    } catch (e) {
      const msg = e?.message || '';
      const code = e?.code || '';
      // User cancelled — close silently
      if (code === 'E_USER_CANCELLED' || (msg && msg.toLowerCase().includes('cancel'))) {
        Analytics.logEvent('purchase_cancelled', { product_id: product?.name, product_type: 'iap' });
        onClose?.();
        return;
      }
      if (msg === 'STORE_UNAVAILABLE' || code === 'STORE_UNAVAILABLE') {
        setError('App Store is not available. Please try again later.');
      } else if (code === 'E_NOT_AVAILABLE') {
        setError('This product is not available in your region.');
      } else if (code === 'E_NETWORK_ERROR') {
        setError('Network error. Check your connection and try again.');
      } else {
        setError('Payment could not be completed. Please try again.');
      }
      Analytics.logEvent('purchase_failed', { product_id: product?.name, product_type: 'iap', error_message: msg, error_code: code });
    } finally {
      setInternalLoading(false);
    }
  };

  const priceDisplay = product.price === 0 ? 'FREE' : `\u00A3${product.price?.toFixed(2)}`;
  const isFree = product.price === 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          {/* Handle */}
          <View style={s.handle} />

          {/* Shield icon area */}
          <View style={s.shieldArea}>
            <View style={[s.shieldCircle, isFree && s.shieldCircleFree]}>
              <Ionicons name={isFree ? 'gift' : 'lock-open'} size={24} color={isFree ? '#22c55e' : '#FFD700'} />
            </View>
          </View>

          {/* Title */}
          <Text style={s.title}>{product.name}</Text>
          {product.description ? (
            <Text style={s.description}>{product.description}</Text>
          ) : null}

          {/* Price breakdown card */}
          <View style={s.breakdownCard}>
            <View style={s.breakdownRow}>
              <Text style={s.breakdownLabel}>Item</Text>
              <Text style={s.breakdownValue} numberOfLines={1}>{product.name}</Text>
            </View>
            <View style={s.breakdownDivider} />
            <View style={s.breakdownRow}>
              <Text style={s.breakdownLabel}>Total</Text>
              <Text style={[s.breakdownPrice, isFree && s.breakdownPriceFree]}>
                {priceDisplay}
              </Text>
            </View>
          </View>

          {/* Confirm button */}
          <TouchableOpacity
            style={[s.confirmBtn, isFree ? s.confirmBtnFree : s.confirmBtnPaid, isLoading && s.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={isFree ? '#09090b' : '#09090b'} />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color={isFree ? '#09090b' : '#09090b'} />
                <Text style={s.confirmText}>{isFree ? 'CLAIM' : 'PAY NOW'}</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Error */}
          {error ? (
            <View style={s.errorRow}>
              <Ionicons name="alert-circle" size={14} color="#ef4444" />
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Cancel */}
          <TouchableOpacity style={s.cancelBtn} onPress={onClose} disabled={isLoading} activeOpacity={0.7}>
            <Text style={s.cancelText}>Cancel</Text>
          </TouchableOpacity>

          {/* Legal */}
          {!isFree && (
            <Text style={s.legal}>
              Payment will be charged to your App Store account.{'\n'}Face ID, Touch ID, or passcode required.
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// BoostSelectModal — XP Boost duration picker sheet
// ---------------------------------------------------------------------------
export function BoostSelectModal({ visible, onClose, onSelect }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.handle} />

          {/* Header */}
          <View style={s.boostHeader}>
            <View style={s.boostHeaderIcon}>
              <Ionicons name="flash" size={20} color="#FFD700" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.boostTitle}>XP BOOST</Text>
              <Text style={s.boostSubtitle}>Earn 1.5x XP on all workouts while active</Text>
            </View>
          </View>

          {/* Multiplier badge */}
          <View style={s.multiplierRow}>
            <View style={s.multiplierBadge}>
              <Text style={s.multiplierBadgeText}>1.5x</Text>
            </View>
            <Text style={s.multiplierLabel}>MULTIPLIER APPLIED TO ALL XP EARNED</Text>
          </View>

          {/* Options */}
          <View style={s.boostOptions}>
            <TouchableOpacity
              style={s.boostCard}
              onPress={() => onSelect({ id: '1hr', name: '1 Hour Boost', price: 0.99, durationHours: 1, multiplier: 1.5, description: '1.5x XP for 1 hour' })}
              activeOpacity={0.7}
            >
              <View style={s.boostCardLeft}>
                <View style={s.boostCardIcon}>
                  <Ionicons name="flash" size={16} color="#FFD700" />
                </View>
                <View>
                  <Text style={s.boostCardName}>1 Hour</Text>
                  <Text style={s.boostCardMeta}>Quick session boost</Text>
                </View>
              </View>
              <Text style={s.boostCardPrice}>{'\u00A30.99'}</Text>
            </TouchableOpacity>

            <View style={s.boostBestRow}>
              <View style={s.bestBadge}>
                <Text style={s.bestBadgeText}>BEST VALUE</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[s.boostCard, s.boostCardFeatured]}
              onPress={() => onSelect({ id: '24hr', name: '24 Hour Boost', price: 2.49, durationHours: 24, multiplier: 1.5, description: '1.5x XP for 24 hours' })}
              activeOpacity={0.7}
            >
              <View style={s.boostCardLeft}>
                <View style={[s.boostCardIcon, s.boostCardIconFeatured]}>
                  <Ionicons name="flash" size={16} color="#FFD700" />
                </View>
                <View>
                  <Text style={s.boostCardName}>24 Hours</Text>
                  <Text style={s.boostCardMeta}>Full day of boosted XP</Text>
                </View>
              </View>
              <Text style={s.boostCardPrice}>{'\u00A32.49'}</Text>
            </TouchableOpacity>
          </View>

          {/* Cancel */}
          <TouchableOpacity style={s.cancelBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={s.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------
const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0f0f11',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#27272a',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3f3f46',
    alignSelf: 'center',
    marginBottom: 20,
  },

  // ── PurchaseModal ──
  shieldArea: {
    alignItems: 'center',
    marginBottom: 16,
  },
  shieldCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 215, 0, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldCircleFree: {
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    borderColor: 'rgba(34, 197, 94, 0.25)',
  },
  title: {
    fontSize: 20,
    fontFamily: 'SpaceGroteskBold',
    color: '#fafafa',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk',
    color: '#71717a',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
    paddingHorizontal: 8,
  },

  // Breakdown card
  breakdownCard: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  breakdownLabel: {
    fontSize: 11,
    fontFamily: 'SpaceGroteskSemiBold',
    color: '#52525b',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  breakdownValue: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk',
    color: '#a1a1aa',
    flex: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: '#27272a',
    marginVertical: 10,
  },
  breakdownPrice: {
    fontSize: 22,
    fontFamily: 'SpaceGroteskBold',
    color: '#FFD700',
    letterSpacing: -0.5,
  },
  breakdownPriceFree: {
    color: '#22c55e',
  },

  // Confirm button
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
    marginBottom: 8,
  },
  confirmBtnPaid: {
    backgroundColor: '#FFD700',
  },
  confirmBtnFree: {
    backgroundColor: '#22c55e',
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  confirmText: {
    fontSize: 14,
    fontFamily: 'SpaceGroteskBold',
    color: '#09090b',
    letterSpacing: 1,
  },

  // Error
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
  },
  errorText: {
    flex: 1,
    fontSize: 11,
    fontFamily: 'SpaceGrotesk',
    color: '#ef4444',
    lineHeight: 15,
  },

  // Cancel
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginBottom: 4,
  },
  cancelText: {
    fontSize: 13,
    fontFamily: 'SpaceGroteskSemiBold',
    color: '#52525b',
    letterSpacing: 0.5,
  },

  // Legal
  legal: {
    fontSize: 10,
    fontFamily: 'SpaceGrotesk',
    color: '#3f3f46',
    textAlign: 'center',
    lineHeight: 15,
    paddingHorizontal: 8,
  },

  // ── BoostSelectModal ──
  boostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  boostHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boostTitle: {
    fontSize: 16,
    fontFamily: 'SpaceGroteskBold',
    color: '#fafafa',
    letterSpacing: -0.2,
  },
  boostSubtitle: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk',
    color: '#71717a',
    marginTop: 2,
    lineHeight: 16,
  },

  // Multiplier badge
  multiplierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  multiplierBadge: {
    backgroundColor: 'rgba(255, 215, 0, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  multiplierBadgeText: {
    fontSize: 14,
    fontFamily: 'SpaceGroteskBold',
    color: '#FFD700',
    letterSpacing: -0.2,
  },
  multiplierLabel: {
    fontSize: 9,
    fontFamily: 'SpaceGroteskSemiBold',
    color: '#52525b',
    letterSpacing: 0.8,
    flex: 1,
  },

  // Boost option cards
  boostOptions: {
    marginBottom: 12,
  },
  boostCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  boostCardFeatured: {
    borderColor: 'rgba(255, 215, 0, 0.25)',
    backgroundColor: '#1a1814',
  },
  boostCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  boostCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 215, 0, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boostCardIconFeatured: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderColor: 'rgba(255, 215, 0, 0.25)',
  },
  boostCardName: {
    fontSize: 15,
    fontFamily: 'SpaceGroteskBold',
    color: '#fafafa',
    letterSpacing: -0.2,
  },
  boostCardMeta: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk',
    color: '#71717a',
    marginTop: 1,
  },
  boostCardPrice: {
    fontSize: 17,
    fontFamily: 'SpaceGroteskBold',
    color: '#FFD700',
    letterSpacing: -0.3,
  },

  // Best value
  boostBestRow: {
    alignItems: 'center',
    marginBottom: 8,
  },
  bestBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  bestBadgeText: {
    fontSize: 8,
    fontFamily: 'SpaceGroteskBold',
    color: '#09090b',
    letterSpacing: 1.5,
  },
});
