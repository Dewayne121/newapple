import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { useStreamlinedOnboarding } from '../../../context/StreamlinedOnboardingContext';
import OnboardingLayout from '../../../components/onboarding/OnboardingLayout';
import * as Haptics from 'expo-haptics';

const GENDER_OPTIONS = [
  { id: 'male', label: 'Male', icon: 'male' },
  { id: 'female', label: 'Female', icon: 'female' },
];

const GenderSelectionScreen = () => {
  const { theme } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const {
    onboardingData,
    updateStepData,
    goToNextStep,
    STEPS,
  } = useStreamlinedOnboarding();

  const selectedGender = onboardingData[STEPS.GENDER]?.selectedGender;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const handleSelect = useCallback(
    (genderId) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      updateStepData(STEPS.GENDER, { selectedGender: genderId });
    },
    [updateStepData, STEPS]
  );

  const handleSkip = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    goToNextStep();
  }, [goToNextStep]);

  return (
    <OnboardingLayout
      title="What's your gender?"
      subtitle="Used for accurate rankings and fair competition"
      showBack={true}
      showSkip={true}
      showProgress={true}
      nextLabel="Continue"
      disableNext={!selectedGender}
      onNext={goToNextStep}
      onSkip={handleSkip}
    >
      <Animated.View style={{ opacity: fadeAnim }}>
        {GENDER_OPTIONS.map((option) => {
          const isSelected = selectedGender === option.id;
          return (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.optionCard,
                {
                  backgroundColor: isSelected ? theme.primary + '18' : theme.bgCard,
                  borderColor: isSelected ? theme.primary : theme.border,
                },
              ]}
              onPress={() => handleSelect(option.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: isSelected ? theme.primary + '25' : theme.bgDeep }]}>
                <Ionicons
                  name={option.icon}
                  size={22}
                  color={isSelected ? theme.primary : theme.textMuted}
                />
              </View>
              <Text
                style={[
                  styles.optionLabel,
                  { color: isSelected ? theme.textMain : theme.textMuted },
                ]}
              >
                {option.label}
              </Text>
              {isSelected && (
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={theme.primary}
                  style={styles.checkIcon}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </Animated.View>
    </OnboardingLayout>
  );
};

const styles = StyleSheet.create({
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'SpaceGroteskSemiBold',
    flex: 1,
  },
  checkIcon: {
    marginLeft: 8,
  },
});

export default GenderSelectionScreen;
