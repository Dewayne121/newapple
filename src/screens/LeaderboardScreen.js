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

const getRankStyle = (rank) => {
  if (rank === 1) return { color: '#FFD700' };
  if (rank === 2) return { color: '#C0C0C0' };
  if (rank === 3) return { color: '#CD7F32' };
  if (rank <= 10) return { color: '#888888' };
  return { color: '#555555' };
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
      <Text style={styles.entryCardTitle}>
        {selectedLiftObj.label.toUpperCase()} ENTRY
      </Text>
      <Text style={styles.entryCardHint}>Enter your best set. Estimated 1RM is calculated automatically.</Text>

      <View style={styles.entryInputRow}>
        <View style={styles.entryField}>
          <Text style={styles.entryFieldLabel}>WEIGHT ({weightUnit.toUpperCase()})</Text>
          <TextInput
            value={entryWeight}
            onChangeText={(value) => setEntryWeight(value.replace(/[^0-9.,]/g, ''))}
            placeholder={`e.g. ${weightUnit === 'lbs' ? '225' : '100'}`}
            placeholderTextColor="#555555"
            keyboardType="decimal-pad"
            style={styles.entryInput}
            returnKeyType="done"
          />
        </View>
        <View style={styles.entryField}>
          <Text style={styles.entryFieldLabel}>REPS</Text>
          <TextInput
            value={entryReps}
            onChangeText={(value) => setEntryReps(value.replace(/[^0-9]/g, ''))}
            placeholder="e.g. 5"
            placeholderTextColor="#555555"
            keyboardType="number-pad"
            style={styles.entryInput}
            returnKeyType="done"
          />
        </View>
      </View>

      <Text style={styles.entryFieldLabel}>LOCATION</Text>
      <View style={styles.entryLocationRow}>
        {['gym', 'home'].map((location) => (
          <TouchableOpacity
            key={location}
            style={[
              styles.entryLocationButton,
              entryLocationType === location && styles.entryLocationButtonActive,
              entryLocationType === location && { borderColor: theme.primary },
            ]}
            onPress={() => setEntryLocationType(location)}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.entryLocationButtonText,
                entryLocationType === location && styles.entryLocationButtonTextActive,
              ]}
            >
              {location.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.entryFieldLabel}>PROOF VIDEO (REQUIRED)</Text>
      <View style={styles.entryVideoActionsRow}>
        <TouchableOpacity
          style={styles.entryVideoActionButton}
          onPress={recordEntryVideo}
          disabled={submittingCoreLift}
          activeOpacity={0.85}
        >
          <Ionicons name="videocam-outline" size={14} color="#ffffff" />
          <Text style={styles.entryVideoActionButtonText}>RECORD</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.entryVideoActionButton}
          onPress={pickEntryVideoFromGallery}
          disabled={submittingCoreLift}
          activeOpacity={0.85}
        >
          <Ionicons name="images-outline" size={14} color="#ffffff" />
          <Text style={styles.entryVideoActionButtonText}>UPLOAD</Text>
        </TouchableOpacity>
      </View>

      {entryVideoUri ? (
        <View style={styles.entryVideoSelectedRow}>
          <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
          <Text style={styles.entryVideoSelectedText}>
            VIDEO READY {entryVideoDuration > 0 ? `(${entryVideoDuration}s)` : ''}
            {entryVideoSource ? ` | ${String(entryVideoSource).toUpperCase()}` : ''}
          </Text>
          <TouchableOpacity
            onPress={() => {
              setEntryVideoUri(null);
              setEntryVideoDuration(0);
              setEntryVideoSource(null);
            }}
            disabled={submittingCoreLift}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={16} color="#999999" />
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.entryVideoHint}>No video selected yet.</Text>
      )}

      <Text style={styles.entryFieldLabel}>NOTES (OPTIONAL)</Text>
      <TextInput
        value={entryNotes}
        onChangeText={setEntryNotes}
        placeholder="Any context for this lift..."
        placeholderTextColor="#555555"
        style={[styles.entryInput, styles.entryNotesInput]}
        multiline
        maxLength={120}
      />

      <TouchableOpacity
        style={[
          styles.entrySubmitButton,
          { backgroundColor: theme.primary },
          submittingCoreLift && styles.entrySubmitButtonDisabled,
        ]}
        onPress={handleSubmitCoreLift}
        disabled={submittingCoreLift}
        activeOpacity={0.85}
      >
        {submittingCoreLift ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <>
            <Ionicons name="barbell-outline" size={14} color="#ffffff" />
            <Text style={styles.entrySubmitButtonText}>SUBMIT TO LEADERBOARD</Text>
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

  if (!user) return <View style={{ flex: 1, backgroundColor: '#050505' }} />;

  const topThree = entries.slice(0, 3);
  const restEntries = entries.slice(3);
  const currentUserVisible = entries.some((entry) => entry.id === user.id);
  const showStickyCurrentUser = currentUserRank && currentUserRank.rank && !currentUserVisible;

  return (
    <View style={styles.page}>
      {/* Tactical HUD Header */}
      <View style={[styles.headerContainer, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerTopRow}>
          <View style={[styles.headerIconBox, { borderColor: theme.primary + '60' }]}>
            <Ionicons name={leaderboardType === 'core' ? 'barbell' : 'trophy'} size={20} color={theme.primary} />
          </View>
          <View style={styles.headerInfo}>
            <Text
              style={styles.headerTitle}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.92}
              allowFontScaling={false}
            >
              LEADERBOARD
            </Text>
            <Text style={styles.headerSubtitle}>
              {leaderboardType === 'core'
                ? `${selectedLiftObj.label.toUpperCase()} | ${selectedRegion.toUpperCase()} | ${(selectedLocationType || 'all').toUpperCase()}`
                : `${selectedChallengeTitle.toUpperCase()} | ${selectedChallengeMetric}`}
            </Text>
          </View>
          <View style={styles.headerStatsRow}>
            <View style={styles.headerStatBlock}>
              <Text style={styles.headerStatLabel}>ACTIVE</Text>
              <Text style={[styles.headerStatValue, { color: '#10B981' }]}>
                {leaderboardType === 'core'
                  ? entries.filter((entry) => entry.bestValue > 0).length
                  : entries.filter((entry) => entry.progress > 0).length}
              </Text>
            </View>
            <View style={styles.headerStatBlock}>
              <Text style={styles.headerStatLabel}>ATHLETES</Text>
              <Text style={[styles.headerStatValue, { color: theme.primary }]}>{entries.length}</Text>
            </View>
          </View>
        </View>
        {/* Type Toggle Row */}
        <View style={styles.typeToggleRow}>
          <TouchableOpacity
            style={[styles.typeButton, leaderboardType === 'core' && styles.typeButtonActive]}
            onPress={() => setLeaderboardType('core')}
          >
            <Text style={[styles.typeButtonText, leaderboardType === 'core' && styles.typeButtonTextActive]}>
              CORE LIFTS
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeButton, leaderboardType === 'challenge' && styles.typeButtonActive]}
            onPress={() => setLeaderboardType('challenge')}
          >
            <Text style={[styles.typeButtonText, leaderboardType === 'challenge' && styles.typeButtonTextActive]}>
              CHALLENGES
            </Text>
          </TouchableOpacity>
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
                <Ionicons name={showCoreFilters ? 'options' : 'options-outline'} size={14} color="#ffffff" />
                <Text style={styles.coreActionButtonText}>{showCoreFilters ? 'HIDE FILTERS' : 'SHOW FILTERS'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.coreActionButton, { borderColor: theme.primary, backgroundColor: 'rgba(155, 44, 44, 0.18)' }]}
                onPress={() => setShowCoreLiftForm(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="add-circle-outline" size={14} color={theme.primary} />
                <Text style={[styles.coreActionButtonText, { color: theme.primary }]}>ADD LIFT</Text>
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
                    {COMPETITIVE_LIFTS.map((lift) => (
                      <TouchableOpacity
                        key={lift.id}
                        style={[
                          styles.selectorButton,
                          selectedLift === lift.id && styles.selectorButtonActive,
                          selectedLift === lift.id && { borderTopColor: theme.primary, borderColor: theme.primary }
                        ]}
                        onPress={() => setSelectedLift(lift.id)}
                        activeOpacity={0.85}
                      >
                        <Text style={[
                          styles.selectorButtonText,
                          selectedLift === lift.id && styles.selectorButtonTextActive
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
                          styles.selectorButton,
                          selectedWeightClass === wc.id && styles.selectorButtonActive,
                          selectedWeightClass === wc.id && { borderTopColor: theme.primary, borderColor: theme.primary }
                        ]}
                        onPress={() => setSelectedWeightClass(wc.id)}
                        activeOpacity={0.85}
                      >
                        <Text style={[
                          styles.selectorButtonText,
                          selectedWeightClass === wc.id && styles.selectorButtonTextActive
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
                          styles.selectorButton,
                          selectedRegion === region.id && styles.selectorButtonActive,
                          selectedRegion === region.id && { borderTopColor: theme.primary, borderColor: theme.primary }
                        ]}
                        onPress={() => setSelectedRegion(region.id)}
                        activeOpacity={0.85}
                      >
                        <Text style={[
                          styles.selectorButtonText,
                          selectedRegion === region.id && styles.selectorButtonTextActive
                        ]}>
                          {region.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Location Selector */}
                <View style={styles.selectorSection}>
                  <Text style={styles.selectorLabel}>LOCATION</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.selectorScrollContent}
                  >
                    {LOCATION_TYPES.map((location) => (
                      <TouchableOpacity
                        key={location.id || 'all'}
                        style={[
                          styles.selectorButton,
                          selectedLocationType === location.id && styles.selectorButtonActive,
                          selectedLocationType === location.id && { borderTopColor: theme.primary, borderColor: theme.primary }
                        ]}
                        onPress={() => setSelectedLocationType(location.id)}
                        activeOpacity={0.85}
                      >
                        <Text style={[
                          styles.selectorButtonText,
                          selectedLocationType === location.id && styles.selectorButtonTextActive
                        ]}>
                          {location.label}
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
                      styles.selectorButton,
                      selectedChallengeId === challenge.id && styles.selectorButtonActive,
                      selectedChallengeId === challenge.id && { borderTopColor: theme.primary, borderColor: theme.primary }
                    ]}
                    onPress={() => setSelectedChallengeId(challenge.id)}
                    activeOpacity={0.85}
                  >
                    <Text style={[
                      styles.selectorButtonText,
                      selectedChallengeId === challenge.id && styles.selectorButtonTextActive
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

        <View style={styles.columnHeaderRow}>
          <Text style={[styles.columnHeaderText, { width: 36 }]}>#</Text>
          <Text style={[styles.columnHeaderText, { flex: 1.2 }]}>ATHLETE</Text>
          <Text style={[styles.columnHeaderText, { flex: 0.8, textAlign: 'center' }]}>
            {leaderboardType === 'core' ? 'CLASS' : 'STATUS'}
          </Text>
          <Text style={[styles.columnHeaderText, { flex: 0.8, textAlign: 'center' }]}>
            {leaderboardType === 'core' ? 'BW' : 'DONE'}
          </Text>
          <Text style={[styles.columnHeaderText, { flex: 1, textAlign: 'right' }]}>
            {leaderboardType === 'core' ? 'BEST' : 'PROGRESS'}
          </Text>
        </View>
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
              <View style={styles.emptyIconBox}>
                <Ionicons name="barbell-outline" size={40} color="#555" />
              </View>
              <Text style={styles.emptyStateText}>NO ENTRIES YET</Text>
              <Text style={styles.emptyStateSubtext}>
                {leaderboardType === 'core'
                  ? 'LOG AND SUBMIT A VERIFIED LIFT TO RANK.'
                  : 'JOIN A CHALLENGE AND SUBMIT AN APPROVED ENTRY TO RANK.'}
              </Text>
            </View>
          )}

          {/* Podium Section - Top 3 */}
          {topThree.length === 3 && (
            <View style={styles.podiumSection}>
              <Text style={styles.podiumLabel}>TOP CONTENDERS</Text>
              <View style={styles.podiumRow}>
                {[topThree[1], topThree[0], topThree[2]].map((item) => {
                  const isFirst = item.rank === 1;
                  const badgeColor = item.rank === 1 ? '#FFD700' : item.rank === 2 ? '#C0C0C0' : '#CD7F32';
                  return (
                    <View
                      key={item.id}
                      style={[
                        styles.podiumCard,
                        isFirst && styles.podiumCardFirst,
                        { borderTopColor: badgeColor },
                      ]}
                    >
                      {item.profileImage ? (
                        <Image source={{ uri: item.profileImage }} style={isFirst ? styles.podiumAvatarLarge : styles.podiumAvatar} />
                      ) : (
                        <View style={[isFirst ? styles.podiumAvatarLarge : styles.podiumAvatar, styles.podiumAvatarFallback]}>
                          <Text style={styles.podiumAvatarText}>{getInitials(item.name)}</Text>
                        </View>
                      )}
                      <View style={[styles.podiumRankBadge, { backgroundColor: badgeColor }]}>
                        <Text style={styles.podiumRankText}>{item.rank}</Text>
                      </View>
                      <Text style={styles.podiumName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.podiumLiftValue}>
                        {leaderboardType === 'core'
                          ? formatLoad(item.bestValue, weightUnit)
                          : formatChallengeProgress(item.progress, item.target)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Rank List */}
          {(topThree.length === 3 ? restEntries : entries).map((item) => {
            const rankStyle = getRankStyle(item.rank);
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => handleViewProfile(item.id)}
                activeOpacity={0.85}
                style={[
                  styles.rankRow,
                  item.rank <= 10 && styles.rankRowTopTen,
                  item.isCurrentUser && styles.rankRowActive,
                  item.isCurrentUser && { borderLeftColor: theme.primary, backgroundColor: 'rgba(155, 44, 44, 0.1)' }
                ]}
              >
                <View style={styles.rankNumCol}>
                  <Text style={[styles.rankNumText, { color: rankStyle.color }]}>
                    {item.rank}
                  </Text>
                </View>

                <View style={[styles.athleteCol, { flex: 1.2 }]}>
                  {item.profileImage ? (
                    <Image source={{ uri: item.profileImage }} style={styles.listAvatar} />
                  ) : (
                    <View style={styles.listAvatarFallback}>
                      <Text style={styles.listAvatarText}>{getInitials(item.name)}</Text>
                    </View>
                  )}
                  <View style={styles.nameWrap}>
                    <Text style={styles.listName} numberOfLines={1}>{item.name}</Text>
                    {item.isCurrentUser && (
                      <View style={[styles.youBadge, { backgroundColor: theme.primary }]}>
                        <Text style={styles.youBadgeText}>YOU</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={[styles.classCol, { flex: 0.8 }]}>
                  <Text style={styles.columnValueText}>
                    {leaderboardType === 'core'
                      ? (item.weightClassLabel?.split(' ')[0] || '--')
                      : (item.completed ? 'DONE' : 'ACTIVE')}
                  </Text>
                </View>

                <View style={[styles.weightCol, { flex: 0.8 }]}>
                  <Text style={styles.columnValueText}>
                    {leaderboardType === 'core'
                      ? formatBodyweight(item.weight, weightUnit)
                      : (item.completed ? 'YES' : 'NO')}
                  </Text>
                </View>

                <View style={[styles.bestCol, { flex: 1 }]}>
                  <View style={[styles.bestPill, item.isCurrentUser && { borderColor: theme.primary }]}>
                    <Text style={[styles.bestPillText, item.isCurrentUser && { color: theme.primary }]}>
                      {leaderboardType === 'core'
                        ? formatLoad(item.bestValue, weightUnit)
                        : formatChallengeProgress(item.progress, item.target)}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Sticky Current User Rank */}
      {showStickyCurrentUser && (
        <View style={[styles.stickyRankContainer, { paddingBottom: insets.bottom + 10 }]}>
          <View style={styles.stickyDivider}>
            <View style={styles.dividerLine} />
            <Text style={[styles.dividerText, { color: theme.primary }]}>YOUR RANK</Text>
            <View style={styles.dividerLine} />
          </View>
          <TouchableOpacity
            onPress={() => handleViewProfile(user.id)}
            activeOpacity={0.85}
            style={[styles.rankRow, styles.rankRowActive, { marginHorizontal: 12, borderLeftColor: theme.primary }]}
          >
            <View style={styles.rankNumCol}>
              <Text style={[styles.rankNumText, { color: theme.primary }]}>
                {currentUserRank.rank || '--'}
              </Text>
            </View>
            <View style={[styles.athleteCol, { flex: 1.2 }]}>
              <View style={[styles.listAvatarFallback, { backgroundColor: theme.primary }]}>
                <Text style={[styles.listAvatarText, { color: '#fff' }]}>{user.name?.substring(0, 2).toUpperCase()}</Text>
              </View>
              <View style={styles.nameWrap}>
                <Text style={styles.listName}>You</Text>
              </View>
            </View>
            <View style={[styles.classCol, { flex: 0.8 }]}>
              <Text style={styles.columnValueText}>
                {leaderboardType === 'core'
                  ? (getWeightClassLabel(currentUserRank.weightClass)?.split(' ')[0] || '--')
                  : 'ACTIVE'}
              </Text>
            </View>
            <View style={[styles.weightCol, { flex: 0.8 }]}>
              <Text style={styles.columnValueText}>
                {leaderboardType === 'core' ? formatBodyweight(user.weight, weightUnit) : 'YES'}
              </Text>
            </View>
            <View style={[styles.bestCol, { flex: 1 }]}>
              <View style={[styles.bestPill, { borderColor: theme.primary }]}>
                <Text style={[styles.bestPillText, { color: theme.primary }]}>
                  {leaderboardType === 'core'
                    ? (currentUserRank.hasEntry ? formatLoad(currentUserRank.bestValue, weightUnit) : '--')
                    : formatChallengeProgress(currentUserRank.progress, selectedChallengeTarget)}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      )}

      <Modal
        visible={leaderboardType === 'core' && showCoreLiftForm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCoreLiftForm(false)}
      >
        <View style={styles.coreLiftModalOverlay}>
          <View style={styles.coreLiftModalCard}>
            {/* Handle bar */}
            <View style={styles.coreLiftModalHandle} />

            {/* Header with accent */}
            <View style={styles.coreLiftModalHeader}>
              <View style={styles.coreLiftModalHeaderLeft}>
                <View style={[styles.coreLiftModalIconBox, { borderColor: theme.primary + '60' }]}>
                  <Ionicons name="barbell" size={16} color={theme.primary} />
                </View>
                <Text style={styles.coreLiftModalTitle}>SUBMIT LIFT</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowCoreLiftForm(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.coreLiftModalCloseBtn}
              >
                <Ionicons name="close" size={18} color="#666666" />
              </TouchableOpacity>
            </View>

            {/* Accent line */}
            <View style={[styles.coreLiftModalAccentLine, { backgroundColor: theme.primary }]} />

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.coreLiftModalContent}>
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
// STYLESHEET: Gritty Gym Industrial HUD - Leaderboard
// -------------------------------------------------------------
function createStyles(theme, insets) {
  return StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: '#050505', // Abyss black
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#050505',
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      paddingBottom: 20,
      },

    // --- Tactical HUD Header ---
    headerContainer: {
      paddingHorizontal: 16,
      paddingBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: '#121212',
      backgroundColor: '#0a0a0a',
    },
    headerTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    headerIconBox: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: '#1a0e0e',
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerInfo: {
      flex: 1,
      minWidth: 0,
      flexShrink: 1,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '900',
      color: '#ffffff',
      letterSpacing: 1,
      paddingRight: 2,
      flexShrink: 1,
    },
    headerSubtitle: {
      fontSize: 10,
      fontWeight: '800',
      color: '#666666',
      letterSpacing: 1.5,
      marginTop: 2,
    },
    headerStatsRow: {
      flexDirection: 'row',
      gap: 16,
    },
    headerStatBlock: {
      alignItems: 'center',
      gap: 2,
    },
    headerStatLabel: {
      fontSize: 9,
      fontWeight: '800',
      color: '#666666',
      letterSpacing: 1.5,
    },
    headerStatValue: {
      fontSize: 18,
      fontWeight: '900',
      letterSpacing: -0.5,
    },
    typeToggleRow: {
      flexDirection: 'row',
      marginTop: 16,
      gap: 8,
    },
    typeButton: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: '#161616',
      borderWidth: 2,
      borderColor: '#1a1a1a',
      alignItems: 'center',
    },
    typeButtonActive: {
      backgroundColor: 'rgba(155, 44, 44, 0.2)',
      borderColor: '#9b2c2c',
    },
    typeButtonText: {
      fontSize: 11,
      fontWeight: '800',
      color: '#666666',
      letterSpacing: 1,
    },
    typeButtonTextActive: {
      color: '#ffffff',
    },

    // --- Selector Sections ---
    selectorSection: {
      paddingHorizontal: 16,
      marginBottom: 12,
      marginTop: 10,
    },
    selectorLabel: {
      fontSize: 10,
      fontWeight: '900',
      color: '#555555',
      letterSpacing: 2,
      marginBottom: 8,
    },
    selectorScrollContent: {
      paddingRight: 20,
      gap: 8,
    },
    selectorButton: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12, // Smooth armor curve
      backgroundColor: '#161616',
      borderTopWidth: 2,
      borderTopColor: '#333333',
      borderWidth: 1,
      borderColor: '#1a1a1a',
    },
    selectorButtonActive: {
      backgroundColor: 'rgba(155, 44, 44, 0.15)',
    },
    selectorButtonText: {
      fontSize: 11,
      fontWeight: '800',
      color: '#666666',
      letterSpacing: 1,
    },
    selectorButtonTextActive: {
      color: '#ffffff',
    },
    coreActionsRow: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
      marginTop: 10,
      marginBottom: 8,
    },
    coreActionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: '#161616',
      borderWidth: 1,
      borderColor: '#2a2a2a',
      borderRadius: 10,
      paddingVertical: 10,
    },
    coreActionButtonText: {
      fontSize: 10,
      fontWeight: '900',
      color: '#ffffff',
      letterSpacing: 1,
    },
    coreLiftModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(5, 5, 5, 0.92)',
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    coreLiftModalCard: {
      backgroundColor: '#0a0a0a',
      borderRadius: 20,
      borderWidth: 1,
      borderColor: '#1a1a1a',
      maxHeight: '85%',
      overflow: 'hidden',
    },
    coreLiftModalHandle: {
      width: 40,
      height: 4,
      backgroundColor: '#333333',
      borderRadius: 2,
      alignSelf: 'center',
      marginTop: 12,
      marginBottom: 16,
    },
    coreLiftModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    coreLiftModalHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    coreLiftModalIconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: 'rgba(155, 44, 44, 0.15)',
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    coreLiftModalTitle: {
      fontSize: 14,
      fontWeight: '900',
      color: '#ffffff',
      letterSpacing: 2,
    },
    coreLiftModalCloseBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: '#161616',
      alignItems: 'center',
      justifyContent: 'center',
    },
    coreLiftModalAccentLine: {
      height: 2,
      marginHorizontal: 16,
      marginBottom: 12,
      borderRadius: 1,
    },
    coreLiftModalContent: {
      paddingHorizontal: 16,
      paddingBottom: 20,
    },
    entryCard: {
      backgroundColor: '#0f0f0f',
      borderWidth: 1,
      borderColor: '#1a1a1a',
      borderRadius: 14,
      padding: 16,
    },
    entryCardTitle: {
      fontSize: 13,
      fontWeight: '900',
      color: '#ffffff',
      letterSpacing: 1.5,
      marginBottom: 6,
    },
    entryCardHint: {
      fontSize: 10,
      fontWeight: '600',
      color: '#555555',
      letterSpacing: 0.5,
      marginBottom: 16,
    },
    entryInputRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    entryField: {
      flex: 1,
    },
    entryFieldLabel: {
      fontSize: 9,
      fontWeight: '900',
      color: '#555555',
      letterSpacing: 1.5,
      marginBottom: 8,
    },
    entryInput: {
      backgroundColor: '#050505',
      borderWidth: 1,
      borderColor: '#1a1a1a',
      borderRadius: 12,
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '800',
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    entryLocationRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 16,
    },
    entryLocationButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: '#1a1a1a',
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
      backgroundColor: '#050505',
    },
    entryLocationButtonActive: {
      backgroundColor: 'rgba(155, 44, 44, 0.2)',
      borderColor: '#9b2c2c',
    },
    entryLocationButtonText: {
      fontSize: 10,
      fontWeight: '900',
      color: '#666666',
      letterSpacing: 1.5,
    },
    entryLocationButtonTextActive: {
      color: '#ffffff',
    },
    entryVideoActionsRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 12,
    },
    entryVideoActionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: '#0f0f0f',
      borderWidth: 1,
      borderColor: '#1a1a1a',
      borderRadius: 12,
      paddingVertical: 12,
    },
    entryVideoActionButtonText: {
      fontSize: 10,
      fontWeight: '900',
      color: '#999999',
      letterSpacing: 1.5,
    },
    entryVideoSelectedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#1a3a1a',
      backgroundColor: 'rgba(34, 197, 94, 0.08)',
    },
    entryVideoSelectedText: {
      flex: 1,
      fontSize: 10,
      fontWeight: '700',
      color: '#4ade80',
      letterSpacing: 0.5,
    },
    entryVideoHint: {
      fontSize: 9,
      fontWeight: '600',
      color: '#555555',
      marginBottom: 12,
      letterSpacing: 0.5,
    },
    entryNotesInput: {
      minHeight: 68,
      textAlignVertical: 'top',
      marginBottom: 12,
    },
    entrySubmitButton: {
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    entrySubmitButtonDisabled: {
      opacity: 0.5,
    },
    entrySubmitButtonText: {
      fontSize: 11,
      fontWeight: '900',
      color: '#ffffff',
      letterSpacing: 1.5,
    },
    challengeMetaText: {
      fontSize: 12,
      fontWeight: '900',
      color: '#dddddd',
      letterSpacing: 1,
      backgroundColor: '#161616',
      borderWidth: 1,
      borderColor: '#2a2a2a',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      alignSelf: 'flex-start',
    },

    // --- Timeframe Selector (HUD Pill) ---
    timeframeContainer: {
      paddingHorizontal: 16,
      marginBottom: 12,
    },
    timeframeSelector: {
      flexDirection: 'row',
      backgroundColor: '#121212',
      borderRadius: 14,
      padding: 4,
      borderWidth: 1,
      borderColor: '#222222',
    },
    timeframeTab: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      borderRadius: 12,
    },
    timeframeTabActive: {},
    timeframeText: {
      fontSize: 11,
      fontWeight: '900',
      color: '#555555',
      letterSpacing: 1,
    },
    timeframeTextActive: {
      color: '#ffffff',
    },

    // --- Column Headers ---
    columnHeaderRow: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      paddingBottom: 12,
      borderBottomWidth: 2,
      borderBottomColor: '#1a1a1a',
    },
    columnHeaderText: {
      fontSize: 10,
      fontWeight: '900',
      color: '#555555',
      letterSpacing: 1.5,
    },

    // --- List Container ---
    listContainer: {
      paddingHorizontal: 12,
      marginTop: 12,
      flex: 1,
    },

    // --- Empty State ---
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
      paddingHorizontal: 20,
    },
    emptyIconBox: {
      width: 80,
      height: 80,
      borderRadius: 20,
      backgroundColor: '#161616',
      borderTopWidth: 2,
      borderTopColor: '#333333',
      borderWidth: 1,
      borderColor: '#1a1a1a',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
    },
    emptyStateText: {
      fontSize: 14,
      fontWeight: '900',
      color: '#666666',
      letterSpacing: 2,
      marginBottom: 8,
    },
    emptyStateSubtext: {
      fontSize: 10,
      fontWeight: '800',
      color: '#444444',
      letterSpacing: 1,
    },

    // --- Podium Section ---
    podiumSection: {
      marginBottom: 24,
      paddingHorizontal: 8,
    },
    podiumLabel: {
      fontSize: 10,
      fontWeight: '900',
      color: '#555555',
      letterSpacing: 2,
      marginBottom: 14,
    },
    podiumRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: 8,
    },
    podiumCard: {
      flex: 1,
      backgroundColor: '#161616',
      borderRadius: 16, // Smooth armor curve
      borderTopWidth: 3,
      padding: 14,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#1a1a1a',
    },
    podiumCardFirst: {
      paddingBottom: 20,
    },
    podiumAvatar: {
      width: 44,
      height: 44,
      borderRadius: 14,
      marginBottom: 10,
    },
    podiumAvatarLarge: {
      width: 60,
      height: 60,
      borderRadius: 18,
      marginBottom: 10,
    },
    podiumAvatarFallback: {
      backgroundColor: '#1a1a1a',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: '#333333',
    },
    podiumAvatarText: {
      fontSize: 14,
      fontWeight: '900',
      color: '#dddddd',
    },
    podiumRankBadge: {
      width: 26,
      height: 26,
      borderRadius: 13,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: -14,
      marginBottom: 8,
    },
    podiumRankText: {
      fontSize: 12,
      fontWeight: '900',
      color: '#000000',
    },
    podiumName: {
      fontSize: 12,
      fontWeight: '900',
      color: '#ffffff',
      textAlign: 'center',
      marginBottom: 4,
    },
    podiumLiftValue: {
      fontSize: 15,
      fontWeight: '900',
      color: '#dddddd',
    },

    // --- Rank Rows (Operation History Cards) ---
    rankRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 10,
      marginBottom: 6,
      borderRadius: 16, // Smooth armor curve
      backgroundColor: '#0a0a0a',
      borderLeftWidth: 4, // Heavy indicator
      borderLeftColor: '#222222',
      borderWidth: 1,
      borderColor: '#1a1a1a',
      borderTopWidth: 2,
      borderTopColor: '#1a1a1a',
    },
    rankRowTopTen: {
      borderLeftColor: '#333333',
      backgroundColor: '#0f0f0f',
    },
    rankRowActive: {},
    rankNumCol: {
      width: 32,
      alignItems: 'center',
      marginRight: 8,
    },
    rankNumText: {
      fontSize: 15,
      fontWeight: '900',
    },
    athleteCol: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    listAvatar: {
      width: 38,
      height: 38,
      borderRadius: 12, // Smooth armor curve
      borderWidth: 2,
      borderColor: '#333333',
    },
    listAvatarFallback: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: '#161616',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: '#2A2A2A',
    },
    listAvatarText: {
      fontSize: 12,
      fontWeight: '900',
      color: '#555555',
    },
    nameWrap: {
      marginLeft: 10,
      flex: 1,
    },
    listName: {
      fontSize: 14,
      fontWeight: '900',
      color: '#ffffff',
    },
    youBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      marginTop: 4,
      alignSelf: 'flex-start',
    },
    youBadgeText: {
      fontSize: 9,
      fontWeight: '900',
      color: '#ffffff',
      letterSpacing: 1,
    },
    classCol: {
      alignItems: 'center',
    },
    weightCol: {
      alignItems: 'center',
    },
    columnValueText: {
      fontSize: 12,
      fontWeight: '800',
      color: '#888888',
    },
    bestCol: {
      alignItems: 'flex-end',
    },
    bestPill: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 12, // Smooth armor curve
      borderWidth: 1,
      borderColor: '#333333',
      minWidth: 70,
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.03)',
    },
    bestPillText: {
      fontSize: 12,
      fontWeight: '900',
      color: '#e5e5e5',
    },

    // --- Sticky Current User Rank ---
    stickyRankContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: '#050505',
      paddingTop: 14,
      borderTopWidth: 2,
      borderTopColor: '#1a1a1a',
      zIndex: 20,
    },
    stickyDivider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      paddingHorizontal: 12,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: '#333333',
    },
    dividerText: {
      fontSize: 9,
      fontWeight: '900',
      marginHorizontal: 12,
      letterSpacing: 2
    }
  });
}
