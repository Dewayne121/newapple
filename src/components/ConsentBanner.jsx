import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as consentManager from '../services/consentManager';

export default function ConsentBanner({ visible, onDone }) {
  const [showCustomize, setShowCustomize] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(false);

  if (!visible) return null;

  const handleAcceptAll = async () => {
    await consentManager.grantAll();
    onDone?.();
  };

  const handleEssentialOnly = async () => {
    await consentManager.denyAll();
    onDone?.();
  };

  const handleSaveCustom = async () => {
    await consentManager.updateConsent('analytics', analytics);
    await consentManager.updateConsent('marketing', marketing);
    onDone?.();
  };

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={handleEssentialOnly}>
      <View style={s.overlay}>
        <View style={s.card}>
          {/* Header */}
          <View style={s.iconWrap}>
            <Ionicons name="shield-checkmark" size={28} color="#DC2626" />
          </View>
          <Text style={s.title}>Your Privacy Matters</Text>
          <Text style={s.subtitle}>
            We collect minimal data to improve your experience. You choose what to share.
          </Text>

          {!showCustomize ? (
            <>
              {/* Quick options */}
              <TouchableOpacity style={s.acceptBtn} onPress={handleAcceptAll} activeOpacity={0.8}>
                <Ionicons name="checkmark-circle" size={18} color="#09090b" />
                <Text style={s.acceptText}>Accept All</Text>
              </TouchableOpacity>

              <TouchableOpacity style={s.essentialBtn} onPress={handleEssentialOnly} activeOpacity={0.8}>
                <Text style={s.essentialText}>Essential Only</Text>
              </TouchableOpacity>

              <TouchableOpacity style={s.customBtn} onPress={() => setShowCustomize(true)} activeOpacity={0.7}>
                <Text style={s.customText}>Customize Preferences</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Toggle rows */}
              <View style={s.toggleRow}>
                <View style={s.toggleInfo}>
                  <Text style={s.toggleLabel}>Essential</Text>
                  <Text style={s.toggleDesc}>Required for app functionality</Text>
                </View>
                <Switch value={true} disabled trackColor={{ false: '#27272a', true: '#3f3f46' }} thumbColor="#71717a" />
              </View>

              <View style={s.toggleRow}>
                <View style={s.toggleInfo}>
                  <Text style={s.toggleLabel}>Analytics</Text>
                  <Text style={s.toggleDesc}>Help us improve the app</Text>
                </View>
                <Switch
                  value={analytics}
                  onValueChange={setAnalytics}
                  trackColor={{ false: '#27272a', true: '#DC2626' }}
                  thumbColor="#fafafa"
                />
              </View>

              <View style={s.toggleRow}>
                <View style={s.toggleInfo}>
                  <Text style={s.toggleLabel}>Marketing</Text>
                  <Text style={s.toggleDesc}>Personalized recommendations</Text>
                </View>
                <Switch
                  value={marketing}
                  onValueChange={setMarketing}
                  trackColor={{ false: '#27272a', true: '#DC2626' }}
                  thumbColor="#fafafa"
                />
              </View>

              <TouchableOpacity style={s.acceptBtn} onPress={handleSaveCustom} activeOpacity={0.8}>
                <Ionicons name="checkmark-circle" size={18} color="#09090b" />
                <Text style={s.acceptText}>Save Preferences</Text>
              </TouchableOpacity>

              <TouchableOpacity style={s.customBtn} onPress={() => setShowCustomize(false)} activeOpacity={0.7}>
                <Text style={s.customText}>Back</Text>
              </TouchableOpacity>
            </>
          )}

          <Text style={s.legal}>
            You can change these preferences anytime in Settings.{'\n'}
            We never sell your data or use it for advertising.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#09090b',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#121214',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#27272a',
    padding: 28,
    alignItems: 'center',
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 22,
    fontFamily: 'SpaceGroteskBold',
    color: '#fafafa',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk',
    color: '#a1a1aa',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24,
    paddingHorizontal: 8,
  },

  // Buttons
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#22c55e',
    marginBottom: 10,
  },
  acceptText: {
    fontSize: 14,
    fontFamily: 'SpaceGroteskBold',
    color: '#09090b',
    letterSpacing: 0.5,
  },
  essentialBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3f3f46',
    alignItems: 'center',
    marginBottom: 10,
  },
  essentialText: {
    fontSize: 14,
    fontFamily: 'SpaceGroteskBold',
    color: '#a1a1aa',
    letterSpacing: 0.5,
  },
  customBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  customText: {
    fontSize: 12,
    fontFamily: 'SpaceGroteskSemiBold',
    color: '#52525b',
    letterSpacing: 0.5,
  },

  // Toggles
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e22',
    marginBottom: 4,
  },
  toggleInfo: {
    flex: 1,
    paddingRight: 12,
  },
  toggleLabel: {
    fontSize: 14,
    fontFamily: 'SpaceGroteskBold',
    color: '#fafafa',
    marginBottom: 2,
  },
  toggleDesc: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk',
    color: '#71717a',
  },

  // Legal
  legal: {
    fontSize: 10,
    fontFamily: 'SpaceGrotesk',
    color: '#3f3f46',
    textAlign: 'center',
    lineHeight: 15,
    marginTop: 12,
    paddingHorizontal: 8,
  },
});
