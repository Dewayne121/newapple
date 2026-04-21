import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { MUSCLE_GROUP_OPTIONS, LOCATION_OPTIONS, generateQuickWorkout, getWorkoutName } from '../utils/exerciseMappings';

export default function QuickWorkoutModal({ visible, onClose, onGenerate }) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState('gym');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!selectedMuscleGroup) return;

    setIsGenerating(true);
    try {
      const workout = generateQuickWorkout(selectedMuscleGroup, selectedLocation);
      const workoutName = getWorkoutName(selectedMuscleGroup, selectedLocation);

      await onGenerate(workout, workoutName, selectedMuscleGroup, selectedLocation);

      handleClose();
    } catch (error) {
      console.error('Error generating workout:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClose = () => {
    setSelectedMuscleGroup(null);
    setSelectedLocation('gym');
    onClose();
  };

  const styles = createStyles(theme);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { paddingBottom: insets.bottom + 16 }]}>
          {/* Handle */}
          <View style={styles.modalHandle} />

          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>QUICK WORKOUT</Text>
              <Text style={styles.modalSub}>Generate a workout instantly</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#a1a1aa" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Location Toggle */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>LOCATION</Text>
              <View style={styles.locationToggle}>
                {['home', 'gym'].map((loc) => {
                  const isActive = selectedLocation === loc;
                  const icon = loc === 'home' ? 'home-outline' : 'barbell-outline';
                  return (
                    <TouchableOpacity
                      key={loc}
                      style={[
                        styles.locationBtn,
                        isActive && styles.locationBtnActive,
                      ]}
                      onPress={() => setSelectedLocation(loc)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name={icon} size={18} color={isActive ? '#fafafa' : '#71717a'} />
                      <Text style={[styles.locationText, isActive && styles.locationTextActive]}>
                        {loc.charAt(0).toUpperCase() + loc.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.locationDesc}>
                {LOCATION_OPTIONS.find(l => l.id === selectedLocation)?.description}
              </Text>
            </View>

            {/* Muscle Group Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>TARGET MUSCLE</Text>
              <View style={styles.muscleGrid}>
                {MUSCLE_GROUP_OPTIONS.map((group) => {
                  const isSelected = selectedMuscleGroup === group.id;
                  return (
                    <TouchableOpacity
                      key={group.id}
                      style={[
                        styles.muscleCard,
                        isSelected && styles.muscleCardActive,
                        isSelected && { borderColor: '#DC2626' },
                      ]}
                      onPress={() => setSelectedMuscleGroup(group.id)}
                      activeOpacity={0.85}
                    >
                      <View style={[styles.muscleIcon, isSelected && styles.muscleIconActive]}>
                        <Ionicons
                          name={group.icon}
                          size={20}
                          color={isSelected ? '#fafafa' : '#DC2626'}
                        />
                      </View>
                      <Text style={[styles.muscleName, isSelected && styles.muscleNameActive]}>
                        {group.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Generate Button */}
            <TouchableOpacity
              style={[
                styles.generateBtn,
                (!selectedMuscleGroup || isGenerating) && styles.generateBtnDisabled,
              ]}
              onPress={handleGenerate}
              disabled={!selectedMuscleGroup || isGenerating}
              activeOpacity={0.85}
            >
              {isGenerating ? (
                <ActivityIndicator color="#fafafa" size="small" />
              ) : (
                <>
                  <Ionicons name="flash" size={18} color="#fafafa" />
                  <Text style={styles.generateBtnText}>GENERATE WORKOUT</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(9, 9, 11, 0.92)',
    },
    modalCard: {
      backgroundColor: '#121214',
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      borderWidth: 1,
      borderColor: '#27272a',
      borderBottomWidth: 0,
      maxHeight: '85%',
      overflow: 'hidden',
    },
    modalHandle: {
      width: 40,
      height: 4,
      backgroundColor: '#27272a',
      borderRadius: 2,
      alignSelf: 'center',
      marginTop: 12,
      marginBottom: 16,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: '#27272a',
    },
    modalTitle: {
      fontSize: 14,
      fontWeight: '900',
      fontFamily: 'SpaceGroteskBold',
      color: '#fafafa',
      letterSpacing: 1.5,
    },
    modalSub: {
      fontSize: 11,
      fontFamily: 'SpaceGrotesk',
      color: '#71717a',
      marginTop: 2,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: '#18181b',
      borderWidth: 1,
      borderColor: '#27272a',
      justifyContent: 'center',
      alignItems: 'center',
    },

    scroll: {
      paddingHorizontal: 16,
    },
    section: {
      marginTop: 16,
      marginBottom: 8,
    },
    sectionLabel: {
      fontSize: 10,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#71717a',
      letterSpacing: 1.5,
      marginBottom: 10,
    },

    // --- Location Toggle ---
    locationToggle: {
      flexDirection: 'row',
      gap: 8,
    },
    locationBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: '#18181b',
      borderWidth: 1,
      borderColor: '#27272a',
    },
    locationBtnActive: {
      backgroundColor: 'rgba(220, 38, 38, 0.1)',
      borderColor: '#DC2626',
    },
    locationText: {
      fontSize: 12,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#71717a',
      letterSpacing: 0.5,
    },
    locationTextActive: {
      color: '#fafafa',
    },
    locationDesc: {
      fontSize: 10,
      fontFamily: 'SpaceGrotesk',
      color: '#52525b',
      marginTop: 8,
      textAlign: 'center',
    },

    // --- Muscle Grid ---
    muscleGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    muscleCard: {
      width: '48%',
      backgroundColor: '#18181b',
      borderRadius: 12,
      padding: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#27272a',
    },
    muscleCardActive: {
      backgroundColor: 'rgba(220, 38, 38, 0.06)',
    },
    muscleIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: 'rgba(220, 38, 38, 0.08)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    muscleIconActive: {
      backgroundColor: '#DC2626',
    },
    muscleName: {
      fontSize: 12,
      fontWeight: '600',
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#a1a1aa',
    },
    muscleNameActive: {
      color: '#fafafa',
    },

    // --- Generate Button ---
    generateBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#DC2626',
      paddingVertical: 14,
      borderRadius: 12,
      gap: 8,
      marginTop: 16,
    },
    generateBtnDisabled: {
      backgroundColor: '#27272a',
    },
    generateBtnText: {
      fontSize: 12,
      fontWeight: '700',
      fontFamily: 'SpaceGroteskBold',
      color: '#fafafa',
      letterSpacing: 1,
    },
  });
}
