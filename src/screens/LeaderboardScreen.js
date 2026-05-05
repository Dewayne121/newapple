import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Image,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { getWeightClassLabel } from '../context/AppContext';
import { COMPETITIVE_LIFTS, resolveCompetitiveLiftId } from '../constants/competitiveLifts';
import api from '../services/api';
import * as purchaseService from '../services/purchaseService';
import CustomAlert, { useCustomAlert } from '../components/CustomAlert';

const WEIGHT_CLASSES = [
  { id: null, label: 'All Classes' },
  { id: 'W55_64', label: '55-64 kg' },
  { id: 'W65_74', label: '65-74 kg' },
  { id: 'W75_84', label: '75-84 kg' },
  { id: 'W85_94', label: '85-94 kg' },
  { id: 'W95_109', label: '95-109 kg' },
  { id: 'W110_PLUS', label: '110+ kg' },
];

const REGIONS = [
  { id: 'Global', label: 'GLOBAL' },
  { id: 'London', label: 'LONDON' },
  { id: 'Manchester', label: 'MANCHESTER' },
  { id: 'Birmingham', label: 'BIRMINGHAM' },
  { id: 'Leeds', label: 'LEEDS' },
  { id: 'Glasgow', label: 'GLASGOW' },
];

const LOCATION_TYPES = [
  { id: null, label: 'ALL LOCATIONS' },
  { id: 'home', label: 'HOME' },
  { id: 'gym', label: 'GYM' },
];

const HOME_LIFTS = ['pushups', 'plank', 'bodyweight_squat', 'incline_pushup', 'step_ups', 'pullups'];
const GYM_LIFTS = ['bench_press', 'deadlift', 'squat', 'barbell_row', 'overhead_press', 'hip_thrust', 'lat_pulldown', 'goblet_squat', 'romanian_deadlift'];

const LOCATION_TABS = [
  { key: null, label: 'All', icon: 'trophy-outline' },
  { key: 'home', label: 'Home', icon: 'home-outline' },
  { key: 'gym', label: 'Gym', icon: 'barbell-outline' },
];

const getLiftsForLocation = (location) => {
  if (!location) return COMPETITIVE_LIFTS;
  const ids = location === 'home' ? HOME_LIFTS : GYM_LIFTS;
  return COMPETITIVE_LIFTS.filter(l => ids.includes(l.id));
};

const getRankStyle = (rank) => {
  if (rank === 1) return { color: '#FFD700' };
  if (rank === 2) return { color: '#C0C0D0' };
  if (rank === 3) return { color: '#CD7F32' };
  if (rank <= 10) return { color: '#a1a1aa' };
  return { color: '#a1a1aa' };
};

const formatLoad = (weightKg, unit) => {
  const value = Number(weightKg) || 0;
  if (value <= 0) return '--';
  if (unit === 'lbs') return `${Math.round(value * 2.20462)} lb`;
  return `${value.toFixed(1)} kg`;
};

const formatBodyweight = (weightKg, unit) => {
  const value = Number(weightKg) || 0;
  if (value <= 0) return '--';
  if (unit === 'lbs') return `${Math.round(value * 2.20462)}lb`;
  return `${value.toFixed(1)}kg`;
};

const extractEntryName = (entry) => entry?.username || entry?.name || 'Unknown';
const getInitials = (name) => String(name || 'U').trim().slice(0, 2).toUpperCase();
const formatChallengeProgress = (progress, target) => {
  const value = Math.max(0, Math.round(Number(progress) || 0));
  const targetValue = Math.max(0, Math.round(Number(target) || 0));
  if (targetValue <= 0) return `${value}`;
  return `${value}/${targetValue}`;
};

const parseNumericInput = (value) => {
  const normalized = String(value || '').trim().replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
};

export default function LeaderboardScreen({ route }) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user, weightUnit } = useApp();
  const { alertConfig, showAlert, hideAlert } = useCustomAlert();

  const requestedLift = useMemo(
    () => resolveCompetitiveLiftId(route?.params?.exerciseId || route?.params?.exercise),
    [route?.params?.exerciseId, route?.params?.exercise]
  );

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserRank, setCurrentUserRank] = useState(null);
  const [selectedWeightClass, setSelectedWeightClass] = useState(null);
  const [selectedLift, setSelectedLift] = useState(requestedLift || COMPETITIVE_LIFTS[0].id);
  const [selectedRegion, setSelectedRegion] = useState('Global');
  const [selectedLocationType, setSelectedLocationType] = useState(null);
  const [leaderboardType, setLeaderboardType] = useState('core'); // 'core' | 'challenge'
  const [challengeOptions, setChallengeOptions] = useState([]);
  const [selectedChallengeId, setSelectedChallengeId] = useState(null);
  const [selectedChallengeMeta, setSelectedChallengeMeta] = useState(null);
  const [showCoreFilters, setShowCoreFilters] = useState(false);
  const [showCoreLiftForm, setShowCoreLiftForm] = useState(false);
  const [entryWeight, setEntryWeight] = useState('');
  const [entryReps, setEntryReps] = useState('');
  const [entryLocationType, setEntryLocationType] = useState('gym');
  const [entryNotes, setEntryNotes] = useState('');
  const [entryVideoUri, setEntryVideoUri] = useState(null);
  const [entryVideoDuration, setEntryVideoDuration] = useState(0);
  const [entryVideoSource, setEntryVideoSource] = useState(null);
  const [submittingCoreLift, setSubmittingCoreLift] = useState(false);

  useEffect(() => {
    if (requestedLift && leaderboardType === 'core') {
      setSelectedLift(requestedLift);
    }
  }, [requestedLift, leaderboardType]);

  useEffect(() => {
    if (leaderboardType !== 'core') {
      setShowCoreFilters(false);
      setShowCoreLiftForm(false);
    }
  }, [leaderboardType]);

  useEffect(() => {
    if (selectedLocationType === 'home' || selectedLocationType === 'gym') {
      setEntryLocationType(selectedLocationType);
    }
  }, [selectedLocationType]);

  // Reset lift selection if it's invalid for the current location
  useEffect(() => {
    if (leaderboardType !== 'core') return;
    const visibleLifts = getLiftsForLocation(selectedLocationType);
    if (visibleLifts.length > 0 && !visibleLifts.find(l => l.id === selectedLift)) {
      setSelectedLift(visibleLifts[0].id);
    }
  }, [selectedLocationType, leaderboardType]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      if (leaderboardType === 'challenge') {
        const challengeListResponse = await api.getChallenges({ includeExpired: 'false' });
        const allChallenges = Array.isArray(challengeListResponse?.data) ? challengeListResponse.data : [];
        const now = new Date();
        const activeChallenges = allChallenges
          .filter((challenge) => challenge?.id && new Date(challenge.endDate) > now && challenge.isActive !== false)
          .sort((a, b) => {
            const joinedDelta = Number(Boolean(b.joined)) - Number(Boolean(a.joined));
            if (joinedDelta !== 0) return joinedDelta;
            const progressDelta = (Number(b.progress) || 0) - (Number(a.progress) || 0);
            if (progressDelta !== 0) return progressDelta;
            return new Date(a.endDate) - new Date(b.endDate);
          });

        setChallengeOptions(activeChallenges);

        if (activeChallenges.length === 0) {
          setEntries([]);
          setCurrentUserRank(null);
          setSelectedChallengeMeta(null);
          return;
        }

        const resolvedChallenge =
          activeChallenges.find((challenge) => challenge.id === selectedChallengeId) ||
          activeChallenges.find((challenge) => challenge.joined) ||
          activeChallenges[0];

        if (resolvedChallenge?.id && resolvedChallenge.id !== selectedChallengeId) {
          setSelectedChallengeId(resolvedChallenge.id);
        }

        const target = Number(resolvedChallenge?.target) || 0;
        setSelectedChallengeMeta({
          id: resolvedChallenge.id,
          title: resolvedChallenge.title,
          target,
          metricType: resolvedChallenge.metricType,
        });

        const leaderboardResponse = await api.request(`/api/challenges/${resolvedChallenge.id}/leaderboard?limit=250`);
        if (leaderboardResponse.success && leaderboardResponse.data) {
          const leaderboardData = (leaderboardResponse.data.leaderboard || []).map((entry) => ({
            id: entry.userId,
            userId: entry.userId,
            name: extractEntryName(entry),
            username: entry.username,
            profileImage: entry.profileImage,
            progress: Number(entry.progress) || 0,
            target,
            completed: Boolean(entry.completed),
            rank: entry.rank,
            isCurrentUser: user && entry.userId === user.id,
          }));

          setEntries(leaderboardData);
          const currentUserEntry = leaderboardData.find((entry) => entry.id === user?.id);
          setCurrentUserRank(
            currentUserEntry
              ? {
                  rank: currentUserEntry.rank,
                  progress: currentUserEntry.progress,
                  hasEntry: true,
                }
              : null
          );
        } else {
          setEntries([]);
          setCurrentUserRank(null);
        }
      } else {
        const params = {
          limit: 100,
          liftType: selectedLift,
          region: selectedRegion,
        };
        if (selectedWeightClass) {
          params.weightClass = selectedWeightClass;
        }
        if (selectedLocationType) {
          params.locationType = selectedLocationType;
        }
        if (user?.gender) {
          params.gender = user.gender;
        }

        const response = await api.getCoreLiftLeaderboard(params);
        if (response.success && response.data) {
          const leaderboardData = (response.data.leaderboard || []).map((entry) => ({
            id: entry.userId || entry.id,
            name: extractEntryName(entry),
            username: entry.username,
            profileImage: entry.profileImage,
            bestValue: Number(entry.estimated1RM) || 0,
            bestReps: Number(entry.bestReps) || 0,
            weight: entry.weight,
            weightClass: entry.weightClass,
            weightClassLabel: entry.weightClassLabel || getWeightClassLabel(entry.weightClass),
            locationType: entry.locationType || 'gym',
            rank: entry.rank,
            isCurrentUser: user && (entry.userId === user.id || entry.id === user.id),
          }));
          setEntries(leaderboardData);
          if (response.data.currentUser) {
            setCurrentUserRank({
              ...response.data.currentUser,
              bestValue: Number(response.data.currentUser.estimated1RM) || 0,
              hasEntry: true,
            });
          } else {
            setCurrentUserRank(null);
          }
        } else {
          setEntries([]);
          setCurrentUserRank(null);
        }
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      setEntries([]);
      setCurrentUserRank(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [
    leaderboardType,
    selectedLift,
    selectedWeightClass,
    selectedRegion,
    selectedLocationType,
    selectedChallengeId,
    user,
  ]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  useFocusEffect(
    useCallback(() => {
      fetchLeaderboard();
    }, [fetchLeaderboard])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const resetCoreLiftForm = useCallback(() => {
    setEntryWeight('');
    setEntryReps('');
    setEntryNotes('');
    setEntryVideoUri(null);
    setEntryVideoDuration(0);
    setEntryVideoSource(null);
  }, []);

  const resolveDurationSeconds = useCallback((durationValue) => {
    const duration = typeof durationValue === 'number' ? durationValue : 0;
    if (!duration) return 0;
    return duration > 1000 ? Math.round(duration / 1000) : Math.round(duration);
  }, []);

  const applySelectedEntryVideo = useCallback((uri, durationSeconds, source) => {
    if (!uri) return false;
    if (!durationSeconds || durationSeconds < 5) {
      showAlert({
        title: 'Video Too Short',
        message: 'Video must be at least 5 seconds.',
        icon: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return false;
    }
    setEntryVideoUri(uri);
    setEntryVideoDuration(durationSeconds);
    setEntryVideoSource(source);
    return true;
  }, [showAlert]);

  const pickEntryVideoFromGallery = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert({
          title: 'Permission Required',
          message: 'Allow photo library access to upload a video.',
          icon: 'warning',
          buttons: [{ text: 'OK', style: 'default' }],
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        videoQuality: 1,
      });

      if (!result.canceled && result.assets?.length > 0) {
        const asset = result.assets[0];
        const durationSeconds = resolveDurationSeconds(asset.duration);
        applySelectedEntryVideo(asset.uri, durationSeconds || 5, 'gallery');
      }
    } catch (error) {
      showAlert({
        title: 'Video Error',
        message: 'Could not select video from gallery.',
        icon: 'error',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    }
  }, [applySelectedEntryVideo, resolveDurationSeconds, showAlert]);

  const recordEntryVideo = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showAlert({
          title: 'Permission Required',
          message: 'Allow camera access to record a video.',
          icon: 'warning',
          buttons: [{ text: 'OK', style: 'default' }],
        });
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        videoQuality: 1,
        videoMaxDuration: 60,
      });

      if (!result.canceled && result.assets?.length > 0) {
        const asset = result.assets[0];
        const durationSeconds = resolveDurationSeconds(asset.duration);
        applySelectedEntryVideo(asset.uri, durationSeconds || 5, 'camera');
      }
    } catch (error) {
      showAlert({
        title: 'Video Error',
        message: 'Could not record video.',
        icon: 'error',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    }
  }, [applySelectedEntryVideo, resolveDurationSeconds, showAlert]);

  const handleSubmitCoreLift = useCallback(async () => {
    const reps = Number.parseInt(String(entryReps || '').trim(), 10);
    const enteredWeight = parseNumericInput(entryWeight);

    if (!Number.isInteger(reps) || reps <= 0) {
      showAlert({
        title: 'Invalid Reps',
        message: 'Enter a valid rep count greater than zero.',
        icon: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }

    if (!Number.isFinite(enteredWeight) || enteredWeight <= 0) {
      showAlert({
        title: 'Invalid Weight',
        message: `Enter a valid weight in ${weightUnit.toUpperCase()}.`,
        icon: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }

    if (!entryVideoUri) {
      showAlert({
        title: 'Proof Required',
        message: 'Record or upload a video before submitting a core lift entry.',
        icon: 'warning',
        buttons: [{ text: 'OK', style: 'default' }],
      });
      return;
    }

    const weightKg = weightUnit === 'lbs' ? enteredWeight / 2.20462 : enteredWeight;
    const liftLabel = COMPETITIVE_LIFTS.find((lift) => lift.id === selectedLift)?.label || 'Lift';

    try {
      setSubmittingCoreLift(true);
      const uploadResponse = await api.uploadVideo(entryVideoUri);
      if (!uploadResponse?.success || !uploadResponse?.data?.videoUrl) {
        throw new Error(uploadResponse?.error || uploadResponse?.message || 'Video upload failed');
      }

      const response = await api.submitCoreLift({
        liftType: selectedLift,
        reps,
        weight: weightKg,
        locationType: entryLocationType,
        notes: entryNotes.trim() || undefined,
        duration: entryVideoDuration || undefined,
        videoUrl: uploadResponse.data.videoUrl,
        originalVideoUrl: uploadResponse.data.videoUrl,
        thumbnailUrl: null,
        serverVideoId: uploadResponse.data.objectName || undefined,
      });

      if (!response?.success) {
        throw new Error(response?.error || response?.message || 'Failed to submit lift');
      }

      showAlert({
        title: 'Submitted',
        message: `${liftLabel} entry submitted. Video is pending admin verification.`,
        icon: 'success',
        buttons: [{ text: 'OK', style: 'default' }],
      });

      resetCoreLiftForm();
      setShowCoreLiftForm(false);
      if (selectedLocationType !== entryLocationType) {
        setSelectedLocationType(entryLocationType);
      } else {
        setRefreshing(true);
        fetchLeaderboard();
      }
    } catch (error) {
      showAlert({
        title: 'Submission Failed',
        message: error?.message || 'Could not submit core lift entry.',
        icon: 'error',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    } finally {
      setSubmittingCoreLift(false);
    }
  }, [
    entryLocationType,
    entryNotes,
    entryReps,
    entryVideoDuration,
    entryVideoUri,
    entryWeight,
    fetchLeaderboard,
    resetCoreLiftForm,
    selectedLift,
    selectedLocationType,
    showAlert,
    weightUnit,
  ]);

  const renderCoreLiftEntryForm = () => (
    <View style={styles.entryCard}>
      {/* Lift Type Header */}
      <View style={styles.entryLiftHeader}>
        <View style={styles.entryLiftIconWrap}>
          <Ionicons name="barbell-outline" size={18} color="#DC2626" />
        </View>
        <View style={styles.entryLiftInfo}>
          <Text style={styles.entryLiftName}>{selectedLiftObj.label}</Text>
          <Text style={styles.entryLiftHint}>Your best set. 1RM is auto-calculated.</Text>
        </View>
      </View>

      {/* Step 1: Weight & Reps */}
      <View style={styles.entryStep}>
        <View style={styles.entryStepHeader}>
          <View style={styles.entryStepDot}>
            <Text style={styles.entryStepDotText}>1</Text>
          </View>
          <Text style={styles.entryStepTitle}>What did you lift?</Text>
        </View>
        <View style={styles.entryInputRow}>
          <View style={styles.entryField}>
            <Text style={styles.entryFieldLabel}>Weight ({weightUnit})</Text>
            <View style={styles.entryInputWrap}>
              <Ionicons name="scale-outline" size={16} color="#52525b" />
              <TextInput
                value={entryWeight}
                onChangeText={(value) => setEntryWeight(value.replace(/[^0-9.,]/g, ''))}
                placeholder={weightUnit === 'lbs' ? '225' : '100'}
                placeholderTextColor="#3f3f46"
                keyboardType="decimal-pad"
                style={styles.entryInput}
                returnKeyType="done"
              />
              <Text style={styles.entryInputUnit}>{weightUnit}</Text>
            </View>
          </View>
          <View style={styles.entryField}>
            <Text style={styles.entryFieldLabel}>Reps</Text>
            <View style={styles.entryInputWrap}>
              <Ionicons name="repeat-outline" size={16} color="#52525b" />
              <TextInput
                value={entryReps}
                onChangeText={(value) => setEntryReps(value.replace(/[^0-9]/g, ''))}
                placeholder="5"
                placeholderTextColor="#3f3f46"
                keyboardType="number-pad"
                style={styles.entryInput}
                returnKeyType="done"
              />
            </View>
          </View>
        </View>
      </View>

      {/* Step 2: Location */}
      <View style={styles.entryStep}>
        <View style={styles.entryStepHeader}>
          <View style={styles.entryStepDot}>
            <Text style={styles.entryStepDotText}>2</Text>
          </View>
          <Text style={styles.entryStepTitle}>Where did you lift?</Text>
        </View>
        <View style={styles.entryLocationRow}>
          <TouchableOpacity
            style={[
              styles.entryLocationCard,
              entryLocationType === 'gym' && styles.entryLocationCardActive,
            ]}
            onPress={() => setEntryLocationType('gym')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="business-outline"
              size={20}
              color={entryLocationType === 'gym' ? '#DC2626' : '#71717a'}
            />
            <Text style={[
              styles.entryLocationLabel,
              entryLocationType === 'gym' && styles.entryLocationLabelActive,
            ]}>
              Gym
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.entryLocationCard,
              entryLocationType === 'home' && styles.entryLocationCardActive,
            ]}
            onPress={() => setEntryLocationType('home')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="home-outline"
              size={20}
              color={entryLocationType === 'home' ? '#DC2626' : '#71717a'}
            />
            <Text style={[
              styles.entryLocationLabel,
              entryLocationType === 'home' && styles.entryLocationLabelActive,
            ]}>
              Home
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Step 3: Video Proof */}
      <View style={styles.entryStep}>
        <View style={styles.entryStepHeader}>
          <View style={styles.entryStepDot}>
            <Text style={styles.entryStepDotText}>3</Text>
          </View>
          <Text style={styles.entryStepTitle}>Video proof (required)</Text>
        </View>

        {entryVideoUri ? (
          <View style={styles.entryVideoConfirmed}>
            <View style={styles.entryVideoConfirmedLeft}>
              <View style={styles.entryVideoConfirmedDot}>
                <Ionicons name="checkmark" size={12} color="#22c55e" />
              </View>
              <View>
                <Text style={styles.entryVideoConfirmedTitle}>Video ready</Text>
                <Text style={styles.entryVideoConfirmedSub}>
                  {entryVideoDuration > 0 ? `${entryVideoDuration}s ` : ''}
                  {entryVideoSource ? String(entryVideoSource).toUpperCase() : ''}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => {
                setEntryVideoUri(null);
                setEntryVideoDuration(0);
                setEntryVideoSource(null);
              }}
              disabled={submittingCoreLift}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={18} color="#71717a" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.entryVideoActionsRow}>
            <TouchableOpacity
              style={styles.entryVideoCard}
              onPress={recordEntryVideo}
              disabled={submittingCoreLift}
              activeOpacity={0.7}
            >
              <View style={styles.entryVideoCardIcon}>
                <Ionicons name="videocam-outline" size={20} color="#DC2626" />
              </View>
              <Text style={styles.entryVideoCardLabel}>Record</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.entryVideoCard}
              onPress={pickEntryVideoFromGallery}
              disabled={submittingCoreLift}
              activeOpacity={0.7}
            >
              <View style={styles.entryVideoCardIcon}>
                <Ionicons name="images-outline" size={20} color="#a1a1aa" />
              </View>
              <Text style={styles.entryVideoCardLabel}>Upload</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Notes */}
      <View style={styles.entryNotesSection}>
        <Text style={styles.entryNotesLabel}>Notes (optional)</Text>
        <TextInput
          value={entryNotes}
          onChangeText={setEntryNotes}
          placeholder="Any context for this lift..."
          placeholderTextColor="#3f3f46"
          style={styles.entryNotesInput}
          multiline
          maxLength={120}
        />
      </View>

      {/* Submit */}
      <TouchableOpacity
        style={[
          styles.entrySubmitButton,
          submittingCoreLift && styles.entrySubmitButtonDisabled,
        ]}
        onPress={handleSubmitCoreLift}
        disabled={submittingCoreLift}
        activeOpacity={0.7}
      >
        {submittingCoreLift ? (
          <ActivityIndicator size="small" color="#fafafa" />
        ) : (
          <>
            <Text style={styles.entrySubmitButtonText}>Submit to Leaderboard</Text>
            <Ionicons name="chevron-forward" size={16} color="#fafafa" />
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  const handleViewProfile = (userId) => {
    navigation.navigate('Profile', { userId });
  };

  const selectedLiftObj = COMPETITIVE_LIFTS.find((lift) => lift.id === selectedLift) || COMPETITIVE_LIFTS[0];
  const selectedChallengeTitle = selectedChallengeMeta?.title || 'CHALLENGE';
  const selectedChallengeTarget = Number(selectedChallengeMeta?.target) || 0;
  const selectedChallengeMetric = (selectedChallengeMeta?.metricType || 'progress').toUpperCase();
  const styles = createStyles(theme, insets);

  if (loading) {
    return (
      <View style={[styles.page, styles.centered]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!user) return <View style={{ flex: 1, backgroundColor: '#09090b' }} />;

  const topThree = entries.slice(0, 3);
  const restEntries = entries.slice(3);
  const currentUserVisible = entries.some((entry) => entry.id === user.id);
  const showStickyCurrentUser = currentUserRank && currentUserRank.rank && !currentUserVisible;

  return (
    <View style={styles.page}>
      {/* Header */}
      <View style={[styles.headerContainer, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>LEADERBOARD</Text>
            <Text style={styles.headerSubtitle}>
              {leaderboardType === 'core'
                ? `${selectedLiftObj.label.toUpperCase()}  /  ${selectedRegion.toUpperCase()}  /  ${(selectedLocationType || 'all').toUpperCase()}`
                : `${selectedChallengeTitle.toUpperCase()}  /  ${selectedChallengeMetric}`}
            </Text>
          </View>
          <View style={styles.headerStats}>
            <Text style={styles.headerStatValue}>
              {entries.length}
            </Text>
            <Text style={styles.headerStatLabel}>ATHLETES</Text>
          </View>
        </View>

        {/* Type Toggle — Underline Tabs */}
        <View style={styles.typeTabNav}>
          <TouchableOpacity
            style={styles.typeTabBtn}
            onPress={() => setLeaderboardType('core')}
            activeOpacity={0.7}
          >
            <Text style={[styles.typeTabText, leaderboardType === 'core' && styles.typeTabTextActive]}>
              Core Lifts
            </Text>
            {leaderboardType === 'core' && <View style={styles.typeTabIndicator} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.typeTabBtn}
            onPress={() => setLeaderboardType('challenge')}
            activeOpacity={0.7}
          >
            <Text style={[styles.typeTabText, leaderboardType === 'challenge' && styles.typeTabTextActive]}>
              Challenges
            </Text>
            {leaderboardType === 'challenge' && <View style={styles.typeTabIndicator} />}
          </TouchableOpacity>
        </View>

        {/* Location Toggle */}
        <View style={styles.locationToggleWrap}>
          {LOCATION_TABS.map((tab) => {
            const isActive = selectedLocationType === tab.key;
            return (
              <TouchableOpacity
                key={tab.key ?? 'all'}
                style={[styles.locationTab, isActive && styles.locationTabActive]}
                onPress={() => setSelectedLocationType(tab.key)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={tab.icon}
                  size={15}
                  color={isActive ? '#fafafa' : '#71717a'}
                />
                <Text style={[styles.locationTabText, isActive && styles.locationTabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.fixedHeader}>
        {leaderboardType === 'core' ? (
          <>
            <View style={styles.coreActionsRow}>
              <TouchableOpacity
                style={styles.coreActionButton}
                onPress={() => setShowCoreFilters((prev) => !prev)}
                activeOpacity={0.85}
              >
                <Ionicons name={showCoreFilters ? 'options' : 'options-outline'} size={14} color="#a1a1aa" />
                <Text style={styles.coreActionButtonText}>{showCoreFilters ? 'HIDE FILTERS' : 'FILTERS'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.coreActionButton, styles.coreActionButtonAccent]}
                onPress={() => setShowCoreLiftForm(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="add-circle-outline" size={14} color="#DC2626" />
                <Text style={styles.coreActionButtonAccentText}>ADD LIFT</Text>
              </TouchableOpacity>
            </View>

            {showCoreFilters && (
              <>
                {/* Lift Selector */}
                <View style={styles.selectorSection}>
                  <Text style={styles.selectorLabel}>LIFT</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.selectorScrollContent}
                  >
                    {getLiftsForLocation(selectedLocationType).map((lift) => (
                      <TouchableOpacity
                        key={lift.id}
                        style={[
                          styles.selectorPill,
                          selectedLift === lift.id && styles.selectorPillActive,
                          selectedLift === lift.id && { borderColor: '#DC2626' }
                        ]}
                        onPress={() => setSelectedLift(lift.id)}
                        activeOpacity={0.85}
                      >
                        <Text style={[
                          styles.selectorPillText,
                          selectedLift === lift.id && styles.selectorPillTextActive
                        ]}>
                          {lift.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Weight Class Selector */}
                <View style={styles.selectorSection}>
                  <Text style={styles.selectorLabel}>WEIGHT CLASS</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.selectorScrollContent}
                  >
                    {WEIGHT_CLASSES.map((wc) => (
                      <TouchableOpacity
                        key={wc.id || 'all'}
                        style={[
                          styles.selectorPill,
                          selectedWeightClass === wc.id && styles.selectorPillActive,
                          selectedWeightClass === wc.id && { borderColor: '#DC2626' }
                        ]}
                        onPress={() => setSelectedWeightClass(wc.id)}
                        activeOpacity={0.85}
                      >
                        <Text style={[
                          styles.selectorPillText,
                          selectedWeightClass === wc.id && styles.selectorPillTextActive
                        ]}>
                          {wc.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Region Selector */}
                <View style={styles.selectorSection}>
                  <Text style={styles.selectorLabel}>REGION</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.selectorScrollContent}
                  >
                    {REGIONS.map((region) => (
                      <TouchableOpacity
                        key={region.id}
                        style={[
                          styles.selectorPill,
                          selectedRegion === region.id && styles.selectorPillActive,
                          selectedRegion === region.id && { borderColor: '#DC2626' }
                        ]}
                        onPress={() => setSelectedRegion(region.id)}
                        activeOpacity={0.85}
                      >
                        <Text style={[
                          styles.selectorPillText,
                          selectedRegion === region.id && styles.selectorPillTextActive
                        ]}>
                          {region.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </>
            )}
          </>
        ) : (
          <>
            <View style={styles.selectorSection}>
              <Text style={styles.selectorLabel}>CHALLENGE</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.selectorScrollContent}
              >
                {challengeOptions.map((challenge) => (
                  <TouchableOpacity
                    key={challenge.id}
                    style={[
                      styles.selectorPill,
                      selectedChallengeId === challenge.id && styles.selectorPillActive,
                      selectedChallengeId === challenge.id && { borderColor: '#DC2626' }
                    ]}
                    onPress={() => setSelectedChallengeId(challenge.id)}
                    activeOpacity={0.85}
                  >
                    <Text style={[
                      styles.selectorPillText,
                      selectedChallengeId === challenge.id && styles.selectorPillTextActive
                    ]}>
                      {String(challenge.title || 'Challenge').toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.selectorSection}>
              <Text style={styles.selectorLabel}>TARGET</Text>
              <Text style={styles.challengeMetaText}>
                {selectedChallengeTarget > 0
                  ? `${selectedChallengeTarget} ${selectedChallengeMetric}`
                  : '--'}
              </Text>
            </View>
          </>
        )}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        maximumZoomScale={1.01}
        nestedScrollEnabled={true}
      >
        <View style={styles.listContainer}>
          {entries.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>NO ENTRIES YET</Text>
              <Text style={styles.emptyStateSubtext}>
                {leaderboardType === 'core'
                  ? 'Log and submit a verified lift to rank.'
                  : 'Join a challenge and submit an approved entry to rank.'}
              </Text>
            </View>
          )}

          {/* Podium Section — Stacked Cards */}
          {topThree.length > 0 && (
            <View style={styles.podiumSection}>
              <Text style={styles.podiumLabel}>TOP CONTENDERS</Text>
              {topThree.map((item) => {
                const medalColor = item.rank === 1 ? '#FFD700' : item.rank === 2 ? '#C0C0D0' : '#CD7F32';
                const isHighlighted = item.isCurrentUser && purchaseService.hasRankHighlight();
                return (
                  <View
                    key={item.id}
                    style={[
                      styles.podiumCard,
                      isHighlighted && {
                        borderColor: '#FFD700',
                        borderWidth: 2,
                        shadowColor: '#FFD700',
                        shadowOpacity: 0.3,
                        shadowRadius: 12,
                        elevation: 8,
                        backgroundColor: 'rgba(255, 215, 0, 0.04)',
                      },
                    ]}
                  >
                    <View style={[styles.podiumColorBar, { backgroundColor: medalColor }]} />
                    <View style={styles.podiumCardContent}>
                      <Text style={[styles.podiumRankNumber, { color: medalColor }]}>
                        {item.rank}
                      </Text>
                      <View style={styles.podiumInfo}>
                        <View style={styles.podiumProfileRow}>
                          {item.profileImage ? (
                            <Image source={{ uri: item.profileImage }} style={styles.podiumAvatar} />
                          ) : (
                            <View style={styles.podiumAvatarFallback}>
                              <Text style={styles.podiumAvatarText}>{getInitials(item.name)}</Text>
                            </View>
                          )}
                          <Text style={styles.podiumName} numberOfLines={1}>{item.name}</Text>
                        </View>
                      </View>
                      <Text style={styles.podiumLiftValue}>
                        {leaderboardType === 'core'
                          ? formatLoad(item.bestValue, weightUnit)
                          : formatChallengeProgress(item.progress, item.target)}
                      </Text>
                    </View>
                    {isHighlighted && (
                      <View style={styles.rankHighlightStar}>
                        <Ionicons name="star" size={14} color="#FFD700" />
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Rank List */}
          {(topThree.length >= 3 ? restEntries : entries).map((item) => {
            const rankColor = getRankStyle(item.rank);
            const isHighlighted = item.isCurrentUser && purchaseService.hasRankHighlight();
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => handleViewProfile(item.id)}
                activeOpacity={0.7}
                style={[
                  styles.rankCard,
                  item.isCurrentUser && styles.rankCardCurrentUser,
                  isHighlighted && {
                    borderColor: '#FFD700',
                    borderWidth: 2,
                    shadowColor: '#FFD700',
                    shadowOpacity: 0.3,
                    shadowRadius: 12,
                    elevation: 8,
                    backgroundColor: 'rgba(255, 215, 0, 0.04)',
                  },
                ]}
              >
                {/* Subtle left color bar inside card */}
                <View style={[styles.rankCardBar, { backgroundColor: item.isCurrentUser ? '#DC2626' : '#27272a' }]} />

                <Text style={[styles.rankNumber, { color: rankColor.color }]}>
                  {item.rank}
                </Text>

                <View style={styles.rankProfileSection}>
                  {item.profileImage ? (
                    <Image source={{ uri: item.profileImage }} style={styles.rankAvatar} />
                  ) : (
                    <View style={styles.rankAvatarFallback}>
                      <Text style={styles.rankAvatarText}>{getInitials(item.name)}</Text>
                    </View>
                  )}
                  <View style={styles.rankNameWrap}>
                    <Text style={styles.rankName} numberOfLines={1}>{item.name}</Text>
                    {item.isCurrentUser && (
                      <View style={styles.youPill}>
                        <Text style={styles.youPillText}>YOU</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.rankValuePill}>
                  <Text style={[styles.rankValueText, item.isCurrentUser && { color: '#DC2626' }]}>
                    {leaderboardType === 'core'
                      ? formatLoad(item.bestValue, weightUnit)
                      : formatChallengeProgress(item.progress, item.target)}
                  </Text>
                </View>

                {isHighlighted && (
                  <View style={styles.rankHighlightStar}>
                    <Ionicons name="star" size={14} color="#FFD700" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Sticky Current User Rank */}
      {showStickyCurrentUser && (
        <View style={[styles.stickyRankContainer, { paddingBottom: insets.bottom + 10 }]}>
          <View style={styles.stickyDividerRow}>
            <View style={styles.stickyDividerLine} />
            <Text style={styles.stickyDividerText}>YOUR RANK</Text>
            <View style={styles.stickyDividerLine} />
          </View>
          <TouchableOpacity
            onPress={() => handleViewProfile(user.id)}
            activeOpacity={0.7}
            style={styles.stickyRankCard}
          >
            <View style={[styles.rankCardBar, { backgroundColor: '#DC2626' }]} />
            <Text style={[styles.rankNumber, { color: '#DC2626' }]}>
              {currentUserRank.rank || '--'}
            </Text>
            <View style={styles.rankProfileSection}>
              <View style={[styles.rankAvatarFallback, { backgroundColor: '#DC2626', borderColor: '#DC2626' }]}>
                <Text style={[styles.rankAvatarText, { color: '#fafafa' }]}>{user.name?.substring(0, 2).toUpperCase()}</Text>
              </View>
              <View style={styles.rankNameWrap}>
                <Text style={styles.rankName}>You</Text>
              </View>
            </View>
            <View style={styles.rankValuePill}>
              <Text style={[styles.rankValueText, { color: '#DC2626' }]}>
                {leaderboardType === 'core'
                  ? (currentUserRank.hasEntry ? formatLoad(currentUserRank.bestValue, weightUnit) : '--')
                  : formatChallengeProgress(currentUserRank.progress, selectedChallengeTarget)}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      <Modal
        visible={leaderboardType === 'core' && showCoreLiftForm}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCoreLiftForm(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowCoreLiftForm(false)}
          />
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 12 }]}>
            {/* Handle */}
            <View style={styles.modalHandleWrap}>
              <View style={styles.modalHandle} />
            </View>

            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Ionicons name="barbell-outline" size={18} color="#DC2626" />
                <Text style={styles.modalTitle}>Submit Lift</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowCoreLiftForm(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={18} color="#a1a1aa" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalContent}>
              {renderCoreLiftEntryForm()}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <CustomAlert {...alertConfig} onClose={hideAlert} />
    </View>
  );
}

// -------------------------------------------------------------
// STYLESHEET: Zinc Minimal — Leaderboard
// -------------------------------------------------------------
function createStyles(theme, insets) {
  return StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: '#09090b',
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#09090b',
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      paddingBottom: 20,
    },

    // --- Header ---
    headerContainer: {
      paddingHorizontal: 16,
      paddingBottom: 0,
      borderBottomWidth: 1,
      borderBottomColor: '#27272a',
      backgroundColor: '#09090b',
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: 20,
    },
    headerLeft: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: '900',
      fontFamily: 'SpaceGroteskBold',
      color: '#fafafa',
      textTransform: 'uppercase',
      letterSpacing: -0.5,
    },
    headerSubtitle: {
      fontSize: 11,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#71717a',
      letterSpacing: 1,
      marginTop: 4,
      textTransform: 'uppercase',
    },
    headerStats: {
      alignItems: 'flex-end',
    },
    headerStatValue: {
      fontSize: 20,
      fontWeight: '700',
      fontFamily: 'SpaceGroteskBold',
      color: '#fafafa',
      letterSpacing: -0.5,
    },
    headerStatLabel: {
      fontSize: 9,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#71717a',
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginTop: 2,
    },

    // --- Type Tab Navigation (underline style) ---
    typeTabNav: {
      flexDirection: 'row',
      marginTop: 16,
      borderBottomWidth: 1,
      borderBottomColor: '#27272a',
    },
    typeTabBtn: {
      paddingBottom: 12,
      paddingHorizontal: 16,
      position: 'relative',
      marginRight: 4,
    },
    typeTabText: {
      fontSize: 12,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#71717a',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    typeTabTextActive: {
      color: '#fafafa',
    },
    typeTabIndicator: {
      position: 'absolute',
      bottom: -1,
      left: 0,
      right: 0,
      height: 2,
      backgroundColor: '#DC2626',
    },

    // --- Location Toggle ---
    locationToggleWrap: {
      flexDirection: 'row',
      marginTop: 16,
      marginBottom: 16,
      gap: 8,
    },
    locationTab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#27272a',
      backgroundColor: '#121214',
    },
    locationTabActive: {
      borderColor: '#DC2626',
      backgroundColor: 'rgba(220, 38, 38, 0.1)',
    },
    locationTabText: {
      fontSize: 12,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#71717a',
      letterSpacing: 0.5,
    },
    locationTabTextActive: {
      color: '#fafafa',
    },

    // --- Fixed Header / Filter Area ---
    fixedHeader: {
      backgroundColor: '#09090b',
    },

    // --- Core Actions Row ---
    coreActionsRow: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
      marginTop: 12,
      marginBottom: 8,
    },
    coreActionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: '#121214',
      borderWidth: 1,
      borderColor: '#27272a',
      borderRadius: 12,
      paddingVertical: 10,
    },
    coreActionButtonText: {
      fontSize: 10,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#a1a1aa',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    coreActionButtonAccent: {
      borderColor: 'rgba(220, 38, 38, 0.3)',
      backgroundColor: 'rgba(220, 38, 38, 0.08)',
    },
    coreActionButtonAccentText: {
      fontSize: 10,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#DC2626',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },

    // --- Selector Sections (Pills) ---
    selectorSection: {
      paddingHorizontal: 16,
      marginBottom: 10,
      marginTop: 8,
    },
    selectorLabel: {
      fontSize: 10,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#71717a',
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    selectorScrollContent: {
      paddingRight: 20,
      gap: 8,
    },
    selectorPill: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: '#121214',
      borderWidth: 1,
      borderColor: '#27272a',
    },
    selectorPillActive: {
      backgroundColor: 'rgba(220, 38, 38, 0.08)',
    },
    selectorPillText: {
      fontSize: 11,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#71717a',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    selectorPillTextActive: {
      color: '#fafafa',
    },
    challengeMetaText: {
      fontSize: 12,
      fontFamily: 'SpaceGroteskBold',
      color: '#fafafa',
      letterSpacing: 0.5,
      backgroundColor: '#121214',
      borderWidth: 1,
      borderColor: '#27272a',
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      alignSelf: 'flex-start',
    },

    // --- List Container ---
    listContainer: {
      paddingHorizontal: 16,
      marginTop: 12,
      gap: 8,
      flex: 1,
    },

    // --- Empty State ---
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
      paddingHorizontal: 20,
    },
    emptyStateText: {
      fontSize: 12,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#71717a',
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    emptyStateSubtext: {
      fontSize: 11,
      fontFamily: 'SpaceGrotesk',
      color: '#52525b',
      letterSpacing: 0.5,
      textAlign: 'center',
    },

    // --- Podium Section (Stacked Cards) ---
    podiumSection: {
      marginBottom: 8,
    },
    podiumLabel: {
      fontSize: 10,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#71717a',
      letterSpacing: 1.5,
      textTransform: 'uppercase',
      marginBottom: 10,
    },
    podiumCard: {
      backgroundColor: '#121214',
      borderWidth: 1,
      borderColor: '#27272a',
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 8,
    },
    podiumColorBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: 4,
      height: '100%',
    },
    podiumCardContent: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      paddingLeft: 18,
      gap: 12,
    },
    podiumRankNumber: {
      fontSize: 28,
      fontWeight: '700',
      fontFamily: 'SpaceGroteskBold',
      letterSpacing: -1,
      width: 44,
    },
    podiumInfo: {
      flex: 1,
      minWidth: 0,
    },
    podiumProfileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    podiumAvatar: {
      width: 36,
      height: 36,
      borderRadius: 10,
    },
    podiumAvatarFallback: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: '#18181b',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#27272a',
    },
    podiumAvatarText: {
      fontSize: 12,
      fontFamily: 'SpaceGroteskBold',
      color: '#a1a1aa',
    },
    podiumName: {
      fontSize: 14,
      fontFamily: 'SpaceGroteskBold',
      color: '#fafafa',
      flex: 1,
      minWidth: 0,
    },
    podiumLiftValue: {
      fontSize: 14,
      fontFamily: 'SpaceGroteskBold',
      color: '#fafafa',
      letterSpacing: -0.3,
    },

    // --- Rank Cards ---
    rankCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#121214',
      borderWidth: 1,
      borderColor: '#27272a',
      borderRadius: 12,
      overflow: 'hidden',
      paddingVertical: 12,
      paddingRight: 12,
      gap: 10,
      position: 'relative',
    },
    rankCardCurrentUser: {
      borderColor: 'rgba(220, 38, 38, 0.2)',
      backgroundColor: 'rgba(220, 38, 38, 0.04)',
    },
    rankCardBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: 3,
      height: '100%',
      backgroundColor: '#27272a',
    },
    rankNumber: {
      fontSize: 14,
      fontFamily: 'SpaceGroteskBold',
      fontWeight: '700',
      width: 28,
      textAlign: 'center',
      marginLeft: 12,
    },
    rankProfileSection: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minWidth: 0,
    },
    rankAvatar: {
      width: 34,
      height: 34,
      borderRadius: 10,
    },
    rankAvatarFallback: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: '#18181b',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#27272a',
    },
    rankAvatarText: {
      fontSize: 11,
      fontFamily: 'SpaceGroteskBold',
      color: '#a1a1aa',
    },
    rankNameWrap: {
      flex: 1,
      minWidth: 0,
    },
    rankName: {
      fontSize: 13,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#fafafa',
    },
    youPill: {
      backgroundColor: '#DC2626',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginTop: 2,
      alignSelf: 'flex-start',
    },
    youPillText: {
      fontSize: 8,
      fontFamily: 'SpaceGroteskBold',
      color: '#fafafa',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    rankHighlightStar: {
      position: 'absolute',
      top: 8,
      right: 8,
    },
    rankValuePill: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      backgroundColor: 'rgba(255, 255, 255, 0.04)',
      borderWidth: 1,
      borderColor: '#27272a',
    },
    rankValueText: {
      fontSize: 12,
      fontFamily: 'SpaceGroteskBold',
      color: '#fafafa',
      letterSpacing: -0.2,
    },

    // --- Sticky Current User Rank ---
    stickyRankContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: '#09090b',
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: '#27272a',
      zIndex: 20,
    },
    stickyDividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
      paddingHorizontal: 16,
    },
    stickyDividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: '#27272a',
    },
    stickyDividerText: {
      fontSize: 9,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#DC2626',
      marginHorizontal: 10,
      letterSpacing: 1.5,
      textTransform: 'uppercase',
    },
    stickyRankCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#121214',
      borderWidth: 1,
      borderColor: 'rgba(220, 38, 38, 0.2)',
      borderRadius: 12,
      overflow: 'hidden',
      marginHorizontal: 16,
      paddingVertical: 12,
      paddingRight: 12,
      gap: 10,
      position: 'relative',
    },

    // --- Core Lift Modal ---
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    modalBackdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    modalSheet: {
      backgroundColor: '#0f0f11',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: '#27272a',
      maxHeight: '92%',
      overflow: 'hidden',
    },
    modalHandleWrap: {
      alignItems: 'center',
      paddingTop: 10,
      paddingBottom: 4,
    },
    modalHandle: {
      width: 36,
      height: 4,
      backgroundColor: '#3f3f46',
      borderRadius: 2,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#1e1e20',
    },
    modalHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    modalTitle: {
      fontSize: 16,
      fontFamily: 'SpaceGroteskBold',
      color: '#fafafa',
      letterSpacing: -0.3,
    },
    modalCloseBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: '#18181b',
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalContent: {
      paddingHorizontal: 20,
      paddingVertical: 16,
    },

    // --- Entry Form ---
    entryCard: {
      gap: 20,
    },

    // Lift header
    entryLiftHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: '#18181b',
      borderWidth: 1,
      borderColor: '#27272a',
      borderRadius: 14,
      padding: 14,
    },
    entryLiftIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: 'rgba(220, 38, 38, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    entryLiftInfo: {
      flex: 1,
    },
    entryLiftName: {
      fontSize: 15,
      fontFamily: 'SpaceGroteskBold',
      color: '#fafafa',
      letterSpacing: -0.2,
    },
    entryLiftHint: {
      fontSize: 12,
      fontFamily: 'SpaceGrotesk',
      color: '#71717a',
      marginTop: 2,
    },

    // Steps
    entryStep: {
      gap: 12,
    },
    entryStepHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    entryStepDot: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: '#DC2626',
      alignItems: 'center',
      justifyContent: 'center',
    },
    entryStepDotText: {
      fontSize: 11,
      fontFamily: 'SpaceGroteskBold',
      color: '#fafafa',
    },
    entryStepTitle: {
      fontSize: 13,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#d4d4d8',
    },

    // Input fields
    entryInputRow: {
      flexDirection: 'row',
      gap: 10,
    },
    entryField: {
      flex: 1,
      gap: 6,
    },
    entryFieldLabel: {
      fontSize: 11,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#71717a',
      letterSpacing: 0.5,
    },
    entryInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#18181b',
      borderWidth: 1,
      borderColor: '#27272a',
      borderRadius: 12,
      paddingHorizontal: 12,
      gap: 8,
      height: 48,
    },
    entryInput: {
      flex: 1,
      color: '#fafafa',
      fontSize: 16,
      fontFamily: 'SpaceGroteskSemiBold',
      padding: 0,
    },
    entryInputUnit: {
      fontSize: 12,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#52525b',
      letterSpacing: 0.5,
    },

    // Location cards
    entryLocationRow: {
      flexDirection: 'row',
      gap: 10,
    },
    entryLocationCard: {
      flex: 1,
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: '#27272a',
      borderRadius: 14,
      paddingVertical: 16,
      backgroundColor: '#18181b',
    },
    entryLocationCardActive: {
      borderColor: '#DC2626',
      backgroundColor: 'rgba(220, 38, 38, 0.08)',
    },
    entryLocationLabel: {
      fontSize: 12,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#71717a',
    },
    entryLocationLabelActive: {
      color: '#fafafa',
    },

    // Video section
    entryVideoActionsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    entryVideoCard: {
      flex: 1,
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: '#18181b',
      borderWidth: 1,
      borderColor: '#27272a',
      borderRadius: 14,
      paddingVertical: 18,
    },
    entryVideoCardIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: '#121214',
      borderWidth: 1,
      borderColor: '#27272a',
      alignItems: 'center',
      justifyContent: 'center',
    },
    entryVideoCardLabel: {
      fontSize: 12,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#a1a1aa',
    },

    // Video confirmed
    entryVideoConfirmed: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: 'rgba(34, 197, 94, 0.06)',
      borderWidth: 1,
      borderColor: 'rgba(34, 197, 94, 0.2)',
      borderRadius: 14,
      padding: 14,
    },
    entryVideoConfirmedLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    entryVideoConfirmedDot: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: 'rgba(34, 197, 94, 0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    entryVideoConfirmedTitle: {
      fontSize: 13,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#4ade80',
    },
    entryVideoConfirmedSub: {
      fontSize: 11,
      fontFamily: 'SpaceGrotesk',
      color: '#166534',
      marginTop: 1,
    },

    // Notes
    entryNotesSection: {
      gap: 6,
    },
    entryNotesLabel: {
      fontSize: 11,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#71717a',
      letterSpacing: 0.5,
    },
    entryNotesInput: {
      backgroundColor: '#18181b',
      borderWidth: 1,
      borderColor: '#27272a',
      borderRadius: 12,
      color: '#fafafa',
      fontSize: 14,
      fontFamily: 'SpaceGrotesk',
      paddingHorizontal: 14,
      paddingVertical: 12,
      minHeight: 64,
      textAlignVertical: 'top',
    },

    // Submit button
    entrySubmitButton: {
      backgroundColor: '#DC2626',
      borderRadius: 14,
      paddingVertical: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    entrySubmitButtonDisabled: {
      opacity: 0.4,
    },
    entrySubmitButtonText: {
      fontSize: 14,
      fontFamily: 'SpaceGroteskBold',
      color: '#fafafa',
      letterSpacing: 0.3,
    },
  });
}
