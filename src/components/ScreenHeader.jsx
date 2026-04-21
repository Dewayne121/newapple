import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { SKINS } from '../constants/colors';

export default function ScreenHeader({
  title,
  subtitle,
  leftAction,
  rightAction,
  showBackButton = false,
  onBackPress,
}) {
  const insets = useSafeAreaInsets();
  const { theme, skin } = useTheme();
  const isDark = skin === SKINS.operator || skin === SKINS.midnight;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      {/* Left: Back button or custom action */}
      {showBackButton ? (
        <TouchableOpacity onPress={onBackPress} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
      ) : leftAction ? (
        leftAction
      ) : (
        <View style={styles.iconBtn} />
      )}

      {/* Center: Title */}
      <View style={styles.center}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>

      {/* Right: Settings button or custom action */}
      {rightAction ? (
        rightAction
      ) : (
        <View style={styles.iconBtn} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e20',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    fontFamily: 'SpaceGroteskBold',
    color: '#fafafa',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'SpaceGroteskSemiBold',
    color: '#a1a1aa',
    marginTop: 2,
  },
});
