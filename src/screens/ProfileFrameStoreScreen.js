import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import ScreenHeader from '../components/ScreenHeader';
import AvatarFrame from '../components/AvatarFrame';
import PurchaseModal from '../components/PurchaseModal';
import * as purchaseService from '../services/purchaseService';
import { PRODUCTS, formatPrice, getFrameById } from '../constants/store';

export default function ProfileFrameStoreScreen({ navigation }) {
  const { user } = useApp();
  const insets = useSafeAreaInsets();
  const [activeFrame, setActiveFrame] = useState('bronze');
  const [ownedFrames, setOwnedFrames] = useState(['bronze']);
  const [showPurchase, setShowPurchase] = useState(false);
  const [pendingFrame, setPendingFrame] = useState(null);

  const loadState = useCallback(() => {
    setActiveFrame(purchaseService.getActiveFrame());
    setOwnedFrames(purchaseService.getOwnedFrames());
  }, []);

  useEffect(() => { loadState(); }, [loadState]);

  const displayName = (user?.name || user?.username || 'A').split(' ')[0];
  const profileImage = user?.profileImage || user?.photoURL;

  const handleBuy = (frame) => {
    if (frame.price === 0) {
      purchaseService.purchaseFrame(frame.id, 0);
      purchaseService.setFrameActive(frame.id);
      loadState();
      return;
    }
    setPendingFrame(frame);
    setShowPurchase(true);
  };

  const handleEquip = (frameId) => {
    purchaseService.setFrameActive(frameId);
    loadState();
  };

  return (
    <View style={s.page}>
      <ScreenHeader title="PROFILE FRAMES" onBack={() => navigation.goBack()} />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingTop: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Preview */}
        <View style={s.previewCard}>
          <Text style={s.previewLabel}>YOUR FRAME</Text>
          <AvatarFrame
            size={80}
            imageUri={profileImage}
            fallbackText={displayName.substring(0, 2).toUpperCase()}
            frameId={activeFrame}
          />
          <Text style={s.previewName}>{(getFrameById(activeFrame) || {}).name || 'Bronze'} Frame</Text>
          {activeFrame !== 'bronze' && (
            <View style={s.equippedBadge}>
              <Ionicons name="checkmark-circle" size={12} color="#22c55e" />
              <Text style={s.equippedText}>EQUIPPED</Text>
            </View>
          )}
        </View>

        {/* Grid */}
        <View style={s.grid}>
          {PRODUCTS.FRAMES.map((frame) => {
            const owned = ownedFrames.includes(frame.id);
            const equipped = activeFrame === frame.id;

            return (
              <TouchableOpacity
                key={frame.id}
                style={[s.frameCard, equipped && s.frameCardEquipped]}
                onPress={() => {
                  if (owned && !equipped) handleEquip(frame.id);
                  else if (!owned) handleBuy(frame);
                }}
                activeOpacity={0.7}
              >
                <AvatarFrame
                  size={48}
                  imageUri={profileImage}
                  fallbackText={displayName.substring(0, 2).toUpperCase()}
                  frameId={frame.id}
                  style={{ alignSelf: 'center', marginBottom: 8 }}
                />
                <Text style={s.frameName}>{frame.name.toUpperCase()}</Text>
                <Text style={s.frameDesc} numberOfLines={1}>{frame.description}</Text>

                {equipped ? (
                  <View style={s.statusEquipped}>
                    <Ionicons name="checkmark-circle" size={12} color="#22c55e" />
                    <Text style={s.statusEquippedText}>EQUIPPED</Text>
                  </View>
                ) : owned ? (
                  <TouchableOpacity
                    style={s.statusEquipBtn}
                    onPress={() => handleEquip(frame.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={s.statusEquipBtnText}>EQUIP</Text>
                  </TouchableOpacity>
                ) : frame.price === 0 ? (
                  <TouchableOpacity
                    style={s.statusFreeBtn}
                    onPress={() => handleBuy(frame)}
                    activeOpacity={0.7}
                  >
                    <Text style={s.statusFreeBtnText}>CLAIM FREE</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={s.statusBuyBtn}
                    onPress={() => handleBuy(frame)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="lock-closed-outline" size={11} color="#FFD700" />
                    <Text style={s.statusBuyBtnText}>{formatPrice(frame.price)}</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <PurchaseModal
        visible={showPurchase}
        onClose={() => { setShowPurchase(false); setPendingFrame(null); }}
        product={{
          name: pendingFrame ? `${pendingFrame.name} Frame` : '',
          description: pendingFrame?.description,
          price: pendingFrame?.price,
        }}
        onPurchaseComplete={async () => {
          if (!pendingFrame) return;
          await purchaseService.purchaseFrame(pendingFrame.id, pendingFrame.price, pendingFrame.sku);
          await purchaseService.setFrameActive(pendingFrame.id);
          loadState();
          setShowPurchase(false);
          setPendingFrame(null);
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#09090b' },
  scroll: { flex: 1 },
  previewCard: {
    alignItems: 'center',
    paddingVertical: 24,
    marginHorizontal: 16,
    backgroundColor: '#121214',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272a',
    marginBottom: 20,
  },
  previewLabel: {
    fontSize: 10,
    fontFamily: 'SpaceGroteskSemiBold',
    color: '#71717a',
    letterSpacing: 1.5,
    marginBottom: 14,
  },
  previewName: {
    fontSize: 14,
    fontFamily: 'SpaceGroteskBold',
    color: '#fafafa',
    marginTop: 10,
    letterSpacing: -0.2,
  },
  equippedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  equippedText: {
    fontSize: 10,
    fontFamily: 'SpaceGroteskBold',
    color: '#22c55e',
    letterSpacing: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
  },
  frameCard: {
    width: '47%',
    backgroundColor: '#121214',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#27272a',
    padding: 14,
    alignItems: 'center',
  },
  frameCardEquipped: {
    borderColor: '#FFD700',
    borderWidth: 2,
  },
  frameName: {
    fontSize: 12,
    fontFamily: 'SpaceGroteskBold',
    color: '#fafafa',
    letterSpacing: 1,
    marginBottom: 2,
  },
  frameDesc: {
    fontSize: 10,
    fontFamily: 'SpaceGrotesk',
    color: '#71717a',
    marginBottom: 10,
  },
  statusEquipped: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusEquippedText: {
    fontSize: 10,
    fontFamily: 'SpaceGroteskBold',
    color: '#22c55e',
    letterSpacing: 1,
  },
  statusEquipBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusEquipBtnText: {
    fontSize: 10,
    fontFamily: 'SpaceGroteskBold',
    color: '#3b82f6',
    letterSpacing: 1,
  },
  statusFreeBtn: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusFreeBtnText: {
    fontSize: 10,
    fontFamily: 'SpaceGroteskBold',
    color: '#22c55e',
    letterSpacing: 1,
  },
  statusBuyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusBuyBtnText: {
    fontSize: 10,
    fontFamily: 'SpaceGroteskBold',
    color: '#FFD700',
    letterSpacing: 0.5,
  },
});
