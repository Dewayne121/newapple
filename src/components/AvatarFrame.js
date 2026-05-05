import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { getFrameById } from '../constants/store';

export default function AvatarFrame({ size = 44, imageUri, fallbackText, frameId, style }) {
  const frame = getFrameById(frameId) || getFrameById('bronze');
  const radius = Math.round(size * 0.28);

  const frameStyle = {
    width: size,
    height: size,
    borderRadius: radius,
    borderWidth: frame.borderWidth,
    borderColor: frame.color,
    ...(frame.glowColor ? {
      shadowColor: frame.glowColor,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 1,
      shadowRadius: Math.round(size * 0.15),
      elevation: 4,
    } : {}),
    overflow: 'hidden',
  };

  const innerSize = size - frame.borderWidth * 2;
  const innerRadius = radius - frame.borderWidth;

  return (
    <View style={[frameStyle, style]}>
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={{ width: innerSize, height: innerSize, borderRadius: Math.max(0, innerRadius) }}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.fallback, { borderRadius: Math.max(0, innerRadius) }]}>
          <Text style={[styles.fallbackText, { fontSize: Math.round(size * 0.35) }]}>
            {fallbackText || '?'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#27272a',
  },
  fallbackText: {
    fontWeight: '700',
    fontFamily: 'SpaceGroteskBold',
    color: '#fff',
  },
});
