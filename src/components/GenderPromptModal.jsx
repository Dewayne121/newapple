import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function GenderPromptModal({ visible, onSelect, loading }) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState(null);

  const handleConfirm = () => {
    if (selected && onSelect) {
      onSelect(selected);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Ionicons name="person" size={40} color="#9b2c2c" />
          </View>

          {/* Title */}
          <Text style={styles.title}>SELECT YOUR GENDER</Text>
          <Text style={styles.subtitle}>
            This helps us provide separate leaderboards and a better experience.
            You can change this later in your profile.
          </Text>

          {/* Options */}
          <View style={styles.optionsRow}>
            <TouchableOpacity
              style={[
                styles.optionButton,
                selected === 'male' && styles.optionButtonActive,
              ]}
              onPress={() => setSelected('male')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="male"
                size={28}
                color={selected === 'male' ? '#ffffff' : '#a1a1aa'}
              />
              <Text
                style={[
                  styles.optionText,
                  selected === 'male' && styles.optionTextActive,
                ]}
              >
                MALE
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.optionButton,
                selected === 'female' && styles.optionButtonActive,
              ]}
              onPress={() => setSelected('female')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="female"
                size={28}
                color={selected === 'female' ? '#ffffff' : '#a1a1aa'}
              />
              <Text
                style={[
                  styles.optionText,
                  selected === 'female' && styles.optionTextActive,
                ]}
              >
                FEMALE
              </Text>
            </TouchableOpacity>
          </View>

          {/* Confirm Button */}
          <TouchableOpacity
            style={[
              styles.confirmButton,
              !selected && styles.confirmButtonDisabled,
            ]}
            onPress={handleConfirm}
            disabled={!selected || loading}
            activeOpacity={0.8}
          >
            <Text style={styles.confirmButtonText}>
              {loading ? 'SAVING...' : 'CONFIRM'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#1e1e20',
    borderRadius: 20,
    padding: 28,
    width: Math.min(SCREEN_WIDTH - 48, 380),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(155, 44, 44, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: 'rgba(155, 44, 44, 0.3)',
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 1.5,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#a1a1aa',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 28,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 28,
    width: '100%',
  },
  optionButton: {
    flex: 1,
    paddingVertical: 20,
    borderRadius: 14,
    backgroundColor: '#121214',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#2a2a2a',
    gap: 8,
  },
  optionButtonActive: {
    backgroundColor: 'rgba(155, 44, 44, 0.2)',
    borderColor: '#9b2c2c',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#a1a1aa',
    letterSpacing: 1,
  },
  optionTextActive: {
    color: '#ffffff',
  },
  confirmButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: '#9b2c2c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#27272a',
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 1.5,
  },
});
