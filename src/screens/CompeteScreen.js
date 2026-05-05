import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import CustomAlert, { useCustomAlert } from '../components/CustomAlert';
import { Analytics } from '../utils/analytics';
import {
  COMPETITIVE_LIFTS,
  getCompetitiveLiftLabel,
  resolveCompetitiveLiftId,
} from '../constants/competitiveLifts';

const FILTERS = [
  { key: 'active', label: 'Active' },
  { key: 'ended', label: 'Completed' },
  { key: 'all', label: 'All' },
];

const HOME_LIFTS = ['pushups', 'plank', 'bodyweight_squat', 'incline_pushup', 'step_ups', 'pullups'];
const GYM_LIFTS = ['bench_press', 'deadlift', 'squat', 'barbell_row', 'overhead_press', 'hip_thrust', 'lat_pulldown', 'goblet_squat', 'romanian_deadlift'];

const LOCATION_TABS = [
  { key: 'all', label: 'All', icon: 'trophy-outline' },
  { key: 'home', label: 'Home', icon: 'home-outline' },
  { key: 'gym', label: 'Gym', icon: 'barbell-outline' },
];

const getLiftsForLocation = (location) => {
  const ids = location === 'home' ? HOME_LIFTS : location === 'gym' ? GYM_LIFTS : COMPETITIVE_LIFTS.map(l => l.id);
  return [
    { id: null, label: 'All' },
    ...COMPETITIVE_LIFTS.filter(l => ids.includes(l.id)).map(lift => ({ id: lift.id, label: lift.label })),
  ];
};

// Mock weekly paid challenges (will come from backend later)
const WEEKLY_PAID_CHALLENGES = [
  {
    id: 'weekly_bench_0427',
    title: 'Bench Press Weekly War',
    exercise: 'bench_press',
    metricType: 'weight',
    target: 100,
    endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    reward: 500,
    participantCount: 48,
    entryFee: 1.99,
    prize: 'Exclusive Badge + 500 XP',
  },
  {
    id: 'weekly_deadlift_0427',
    title: 'Deadlift Max Week',
    exercise: 'deadlift',
    metricType: 'weight',
    target: 140,
    endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    reward: 500,
    participantCount: 32,
    entryFee: 1.99,
    prize: 'Exclusive Badge + 500 XP',
  },
  {
    id: 'weekly_squat_0427',
    title: 'Squat Endurance Battle',
    exercise: 'squat',
    metricType: 'reps',
    target: 50,
    endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    reward: 500,
    participantCount: 27,
    entryFee: 1.99,
    prize: 'Exclusive Badge + 500 XP',
  },
];

export default function CompeteScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const { theme } = useTheme();
  const { alertConfig, showAlert, hideAlert } = useCustomAlert();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [challenges, setChallenges] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState('active');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [selectedLift, setSelectedLift] = useState(null);
  const [joining, setJoining] = useState(null);

  const locationLiftFilters = getLiftsForLocation(selectedLocation);

  const getChallengeId = (challenge) => challenge?.id || challenge?._id || null;
  const getChallengeLiftId = (challenge) => {
    if (challenge?.primaryExercise) return resolveCompetitiveLiftId(challenge.primaryExercise);
    const normalized = (challenge?.normalizedExercises || [])
      .map((value) => resolveCompetitiveLiftId(value))
      .filter(Boolean);
    if (normalized.length > 0) return normalized[0];
    const raw = (challenge?.exercises || [])
      .map((value) => resolveCompetitiveLiftId(value))
      .filter(Boolean);
    return raw[0] || null;
  };

  useEffect(() => {
    setSelectedLift(null);
  }, [selectedLocation]);

  useEffect(() => {
    loadChallenges();
  }, [selectedFilter, selectedLocation, selectedLift]);

  const loadChallenges = async () => {
    try {
      setLoading(true);
      const params = {
        region: user?.region || 'global',
        includeExpired: selectedFilter !== 'active' ? 'true' : 'false',
        competitiveOnly: 'true',
      };
      if (selectedLift) {
        params.exercise = selectedLift;
      }

      const response = await api.getChallenges(params);

      if (response.success) {
        const locationIds = selectedLocation === 'all'
          ? null
          : selectedLocation === 'home' ? HOME_LIFTS : GYM_LIFTS;

        const filtered = (response.data || []).filter((challenge) => {
          const liftId = getChallengeLiftId(challenge);
          if (!(selectedLift ? liftId === selectedLift : !!liftId)) {
            return false;
          }

          if (locationIds && !locationIds.includes(liftId)) {
            return false;
          }

          if (selectedFilter === 'ended') {
            const ended = new Date(challenge.endDate) <= new Date();
            return ended || challenge.isActive === false;
          }

          return true;
        });
        setChallenges(filtered);
      } else {
        setChallenges([]);
      }
    } catch (err) {
      console.error('Error loading challenges:', err);
      setChallenges([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadChallenges();
  };

  const confirmLeave = (challenge) => {
    showAlert({
      title: 'Leave Challenge?',
      message: 'Leaving will forfeit your progress. Are you sure?',
      icon: 'warning',
      buttons: [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => handleJoinLeave(challenge),
        },
      ],
    });
  };

  const handleJoinLeave = async (challenge) => {
    try {
      const challengeId = getChallengeId(challenge);
      if (!challengeId) {
        throw new Error('Challenge ID is missing.');
      }
      setJoining(challengeId);

      if (challenge.joined) {
        await api.leaveChallenge(challengeId);
        setChallenges(prev => prev.map(c => (
          getChallengeId(c) === challengeId ? { ...c, joined: false, progress: 0 } : c
        )));
      } else {
        await api.joinChallenge(challengeId);
        Analytics.logChallengeJoined(challengeId);
        setChallenges(prev => prev.map(c => (
          getChallengeId(c) === challengeId ? { ...c, joined: true, progress: 0 } : c
        )));
        showAlert({
          title: 'Joined',
          message: `You're now in ${challenge.title}. Give it everything.`,
          icon: 'success',
          buttons: [{ text: 'Got it', style: 'default' }],
        });
      }
    } catch (err) {
      showAlert({
        title: 'Error',
        message: err.message || 'Could not join challenge.',
        icon: 'error',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    } finally {
      setJoining(null);
    }
  };

  const getTimeRemaining = (endDate) => {
    const now = new Date();
    const end = new Date(endDate);
    const diff = end - now;
    if (diff <= 0) return { text: 'Ended', expired: true, days: 0 };
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return { text: `${days}d ${hours}h left`, expired: false, days };
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return { text: `${hours}h ${minutes}m left`, expired: false, days: 0 };
  };

  const styles = createStyles(theme, insets);

  const activeJoinedCount = challenges.filter(c => c.joined && !c.completed).length;

  return (
    <View style={styles.page}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>COMPETE</Text>
            <Text style={styles.headerSub}>
              {activeJoinedCount} active {activeJoinedCount === 1 ? 'challenge' : 'challenges'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation.navigate('Leaderboard')}
          >
            <Ionicons name="podium-outline" size={18} color="#a1a1aa" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Location Toggle */}
      <View style={styles.locationToggleWrap}>
        {LOCATION_TABS.map((tab) => {
          const isActive = selectedLocation === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.locationTab, isActive && styles.locationTabActive]}
              onPress={() => setSelectedLocation(tab.key)}
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

      {/* Tabs */}
      <View style={styles.tabNav}>
        {FILTERS.map((filter) => (
          <TouchableOpacity
            key={filter.key}
            style={styles.tabBtn}
            onPress={() => setSelectedFilter(filter.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabBtnText, selectedFilter === filter.key && styles.tabBtnTextActive]}>
              {filter.label}
            </Text>
            {selectedFilter === filter.key && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Lift Filters */}
      <View style={styles.liftFilterWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.liftFilterScroll}
        >
          {locationLiftFilters.map((lift) => {
            const isActive = selectedLift === lift.id;
            return (
              <TouchableOpacity
                key={lift.id || 'all'}
                style={[styles.liftChip, isActive && styles.liftChipActive]}
                onPress={() => setSelectedLift(isActive ? null : lift.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.liftChipText, isActive && styles.liftChipTextActive]}>
                  {lift.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#DC2626" />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 110 + insets.bottom }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#DC2626" />}
          showsVerticalScrollIndicator={false}
        >
          {/* ── WEEKLY PAID CHALLENGES (COMING SOON) ── */}
          {(() => {
            const filteredPaid = WEEKLY_PAID_CHALLENGES.filter((wc) => {
              if (selectedLift && wc.exercise !== selectedLift) return false;
              const locationIds = selectedLocation === 'all'
                ? null
                : selectedLocation === 'home' ? HOME_LIFTS : GYM_LIFTS;
              if (locationIds && !locationIds.includes(wc.exercise)) return false;
              return true;
            });
            if (filteredPaid.length === 0) return null;
            return (
              <View style={styles.paidSection}>
                <View style={styles.paidSectionHeader}>
                  <View style={styles.paidSectionHeaderLeft}>
                    <Ionicons name="diamond" size={15} color="#3f3f46" />
                    <Text style={styles.paidSectionTitleGrey}>WEEKLY CHALLENGES</Text>
                  </View>
                  <View style={styles.comingSoonBadge}>
                    <Text style={styles.comingSoonText}>COMING SOON</Text>
                  </View>
                </View>

                {filteredPaid.map((wc) => {
                  const liftLabel = getCompetitiveLiftLabel(wc.exercise) || wc.exercise;

                  return (
                    <View key={wc.id} style={styles.paidCardGrey}>
                      <View style={styles.paidCardAccentGrey} />
                      <View style={styles.paidCardBody}>
                        <View style={styles.paidCardTop}>
                          <View style={styles.paidCardTitleRow}>
                            <Ionicons name="crown" size={14} color="#52525b" />
                            <Text style={styles.paidCardTitleGrey} numberOfLines={1}>{wc.title}</Text>
                          </View>
                          <View style={styles.paidPillFeeGrey}>
                            <Ionicons name="lock-closed" size={10} color="#52525b" />
                            <Text style={styles.paidPillFeeTextGrey}>{`\u00A3${wc.entryFee.toFixed(2)}`}</Text>
                          </View>
                        </View>

                        <View style={styles.paidCardLift}>
                          <Ionicons name="barbell-outline" size={10} color="#3f3f46" />
                          <Text style={styles.paidCardLiftTextGrey}>{liftLabel}</Text>
                        </View>

                        <View style={styles.paidCardMeta}>
                          <View style={styles.paidMetaItem}>
                            <Ionicons name="time-outline" size={12} color="#3f3f46" />
                            <Text style={styles.paidMetaValueGrey}>5d 0h left</Text>
                          </View>
                          <View style={styles.paidMetaItem}>
                            <Ionicons name="people-outline" size={12} color="#3f3f46" />
                            <Text style={styles.paidMetaValueGrey}>{wc.participantCount}</Text>
                          </View>
                          <View style={styles.paidMetaItem}>
                            <Ionicons name="star-outline" size={12} color="#3f3f46" />
                            <Text style={styles.paidMetaValueGrey}>+{wc.reward} XP</Text>
                          </View>
                        </View>

                        <View style={styles.paidComingSoonRow}>
                          <Ionicons name="hourglass-outline" size={12} color="#52525b" />
                          <Text style={styles.paidComingSoonText}>{wc.prize}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })()}

          {/* ── REGULAR CHALLENGES ── */}
          {challenges.length > 0 ? (
            <View style={styles.cardList}>
              {challenges.map((challenge, index) => {
                const challengeId = getChallengeId(challenge);
                const timeInfo = getTimeRemaining(challenge.endDate);
                const isJoined = challenge.joined;
                const isCompleted = challenge.completed;
                const progressPercent = challenge.target > 0
                  ? Math.min(100, ((challenge.progress || 0) / challenge.target) * 100)
                  : 0;
                const liftId = getChallengeLiftId(challenge);
                const liftLabel = getCompetitiveLiftLabel(liftId) || 'Challenge';

                const accentColor = isCompleted ? '#22c55e' : isJoined ? '#DC2626' : '#27272a';

                return (
                  <TouchableOpacity
                    key={challengeId || index}
                    style={styles.card}
                    onPress={() => navigation.navigate('ChallengeDetail', { challengeId })}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.cardAccent, { backgroundColor: accentColor }]} />

                    <View style={styles.cardBody}>
                      {/* Title + Status Pill */}
                      <View style={styles.cardTop}>
                        <View style={styles.cardTitleWrap}>
                          <Text style={styles.cardTitle} numberOfLines={1}>
                            {challenge.title}
                          </Text>
                          {challenge.isSeasonal && (
                            <View style={styles.seasonalPill}>
                              <Ionicons name="star" size={9} color="#ffd700" />
                              <Text style={styles.seasonalPillText}>SEASONAL</Text>
                            </View>
                          )}
                        </View>

                        {isCompleted ? (
                          <View style={styles.pillCompleted}>
                            <Ionicons name="checkmark" size={10} color="#22c55e" />
                            <Text style={styles.pillCompletedText}>Done</Text>
                          </View>
                        ) : isJoined ? (
                          <View style={styles.pillJoined}>
                            <View style={styles.pillJoinedDot} />
                            <Text style={styles.pillJoinedText}>Joined</Text>
                          </View>
                        ) : (
                          <View style={styles.pillOpen}>
                            <Text style={styles.pillOpenText}>Open</Text>
                          </View>
                        )}
                      </View>

                      {/* Lift badge */}
                      <View style={styles.liftBadge}>
                        <Ionicons name="barbell-outline" size={10} color="#71717a" />
                        <Text style={styles.liftBadgeText}>{liftLabel}</Text>
                      </View>

                      {/* Meta row */}
                      <View style={styles.cardMeta}>
                        <View style={styles.metaItem}>
                          <Ionicons name="time-outline" size={12} color="#a1a1aa" />
                          <Text style={[
                            styles.metaValue,
                            timeInfo.expired && styles.metaValueExpired,
                          ]}>
                            {timeInfo.text}
                          </Text>
                        </View>
                        <View style={styles.metaItem}>
                          <Ionicons name="people-outline" size={12} color="#a1a1aa" />
                          <Text style={styles.metaValue}>{challenge.participantCount || 0}</Text>
                        </View>
                        {challenge.reward ? (
                          <View style={styles.metaItem}>
                            <Ionicons name="star-outline" size={12} color="#a1a1aa" />
                            <Text style={styles.metaReward}>+{challenge.reward} XP</Text>
                          </View>
                        ) : null}
                      </View>

                      {/* Progress (joined only) */}
                      {isJoined && (
                        <View style={styles.progressSection}>
                          <View style={styles.progressHeader}>
                            <Text style={styles.progressLabel}>
                              <Ionicons name="flame" size={11} color="#DC2626" /> Progress
                            </Text>
                            <Text style={styles.progressValue}>
                              {challenge.progress || 0}/{challenge.target}
                            </Text>
                          </View>
                          <View style={styles.progressBar}>
                            <View style={[
                              styles.progressFill,
                              {
                                width: `${progressPercent}%`,
                                backgroundColor: isCompleted ? '#22c55e' : '#DC2626',
                              },
                            ]} />
                          </View>
                        </View>
                      )}

                      {/* Action */}
                      <TouchableOpacity
                        style={[
                          styles.actionBtn,
                          isJoined ? styles.actionBtnLeave : styles.actionBtnJoin,
                          (joining === challengeId || timeInfo.expired) && styles.actionBtnDisabled,
                        ]}
                        activeOpacity={0.7}
                        onPress={(e) => {
                          e.stopPropagation();
                          if (isJoined) confirmLeave(challenge);
                          else handleJoinLeave(challenge);
                        }}
                        disabled={joining === challengeId || timeInfo.expired}
                      >
                        {joining === challengeId ? (
                          <ActivityIndicator size="small" color={isJoined ? '#DC2626' : '#fafafa'} />
                        ) : (
                          <Text style={[styles.actionBtnText, isJoined && styles.actionBtnTextLeave]}>
                            {isJoined ? 'Leave' : 'Join Challenge'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="flag-outline" size={24} color="#52525b" />
              </View>
              <Text style={styles.emptyTitle}>No challenges found</Text>
              <Text style={styles.emptySub}>
                {selectedFilter === 'active' ? 'Check back later for new challenges' : 'No completed challenges yet'}
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      <CustomAlert {...alertConfig} onClose={hideAlert} />

    </View>
  );
}

function createStyles(theme, insets) {
  return StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: '#09090b',
    },

    // --- Header ---
    header: {
      paddingHorizontal: 16,
      paddingBottom: 24,
      borderBottomWidth: 1,
      borderBottomColor: '#27272a',
      backgroundColor: '#09090b',
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
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
    headerSub: {
      fontSize: 12,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#71717a',
      letterSpacing: 0.5,
      marginTop: 4,
    },
    headerBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: '#121214',
      borderWidth: 1,
      borderColor: '#27272a',
      justifyContent: 'center',
      alignItems: 'center',
    },

    // --- Location Toggle ---
    locationToggleWrap: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginTop: 16,
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

    // --- Tabs ---
    tabNav: {
      flexDirection: 'row',
      marginTop: 0,
      paddingHorizontal: 16,
      paddingTop: 16,
      borderBottomWidth: 1,
      borderBottomColor: '#27272a',
      backgroundColor: '#09090b',
    },
    tabBtn: {
      paddingBottom: 16,
      paddingHorizontal: 12,
      position: 'relative',
      marginRight: 4,
    },
    tabBtnText: {
      fontSize: 12,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#71717a',
      letterSpacing: 0.5,
    },
    tabBtnTextActive: {
      color: '#fafafa',
    },
    tabIndicator: {
      position: 'absolute',
      bottom: -1,
      left: 0,
      right: 0,
      height: 2,
      backgroundColor: '#DC2626',
    },

    // --- Lift Filters ---
    liftFilterWrap: {
      backgroundColor: '#09090b',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#27272a',
    },
    liftFilterScroll: {
      paddingHorizontal: 16,
      gap: 8,
    },
    liftChip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#27272a',
      backgroundColor: '#121214',
    },
    liftChipActive: {
      borderColor: '#DC2626',
      backgroundColor: 'rgba(220, 38, 38, 0.1)',
    },
    liftChipText: {
      fontSize: 12,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#71717a',
    },
    liftChipTextActive: {
      color: '#fafafa',
    },

    // --- Scroll ---
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#09090b',
    },

    // --- Card List ---
    cardList: {
      gap: 12,
    },

    // --- Challenge Card ---
    card: {
      backgroundColor: '#121214',
      borderWidth: 1,
      borderColor: '#27272a',
      borderRadius: 16,
      overflow: 'hidden',
    },
    cardAccent: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: 4,
      height: '100%',
      borderRadius: 4,
    },
    cardBody: {
      padding: 16,
      paddingLeft: 20,
    },

    // Card Top
    cardTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    cardTitleWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingRight: 16,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: '700',
      fontFamily: 'SpaceGroteskBold',
      color: '#fafafa',
      letterSpacing: -0.3,
      flex: 1,
    },

    // Lift Badge
    liftBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: '#18181b',
      borderWidth: 1,
      borderColor: '#27272a',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      alignSelf: 'flex-start',
      marginBottom: 16,
    },
    liftBadgeText: {
      fontSize: 11,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#a1a1aa',
      letterSpacing: 0.5,
    },

    // Seasonal Pill
    seasonalPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(255, 215, 0, 0.1)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
    },
    seasonalPillText: {
      fontSize: 8,
      fontFamily: 'SpaceGroteskBold',
      color: '#ffd700',
      letterSpacing: 1,
    },

    // Status Pills
    pillCompleted: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderWidth: 1,
      borderColor: 'rgba(34, 197, 94, 0.3)',
      backgroundColor: 'rgba(34, 197, 94, 0.1)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    pillCompletedText: {
      fontSize: 10,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#22c55e',
      letterSpacing: 0.5,
    },
    pillJoined: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderWidth: 1,
      borderColor: 'rgba(220, 38, 38, 0.3)',
      backgroundColor: 'rgba(220, 38, 38, 0.1)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    pillJoinedDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#DC2626',
    },
    pillJoinedText: {
      fontSize: 10,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#DC2626',
      letterSpacing: 0.5,
    },
    pillOpen: {
      borderWidth: 1,
      borderColor: '#3f3f46',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    pillOpenText: {
      fontSize: 10,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#a1a1aa',
      letterSpacing: 0.5,
    },

    // Meta Row
    cardMeta: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: '#27272a',
      paddingTop: 16,
      gap: 16,
      marginBottom: 16,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    metaValue: {
      fontSize: 12,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#d4d4d8',
      letterSpacing: 0.3,
    },
    metaValueExpired: {
      color: '#DC2626',
    },
    metaReward: {
      fontSize: 12,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#FFD700',
      letterSpacing: 0.3,
    },

    // Progress
    progressSection: {
      marginBottom: 16,
    },
    progressHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    progressLabel: {
      fontSize: 10,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#DC2626',
      letterSpacing: 0.5,
    },
    progressValue: {
      fontSize: 10,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#d4d4d8',
    },
    progressBar: {
      height: 6,
      backgroundColor: '#27272a',
      borderRadius: 99,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 99,
    },

    // Action Button
    actionBtn: {
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionBtnJoin: {
      backgroundColor: '#DC2626',
    },
    actionBtnLeave: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: '#27272a',
    },
    actionBtnDisabled: {
      opacity: 0.35,
    },
    actionBtnText: {
      fontSize: 12,
      fontFamily: 'SpaceGroteskBold',
      fontWeight: '700',
      color: '#fafafa',
      letterSpacing: 0.5,
    },
    actionBtnTextLeave: {
      color: '#a1a1aa',
    },

    // Empty State
    emptyState: {
      borderWidth: 1,
      borderColor: '#27272a',
      backgroundColor: '#121214',
      padding: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
    },
    emptyIcon: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: '#18181b',
      borderWidth: 1,
      borderColor: '#27272a',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 12,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#71717a',
      letterSpacing: 0.5,
    },
    emptySub: {
      fontSize: 12,
      fontFamily: 'SpaceGrotesk',
      color: '#52525b',
      marginTop: 4,
    },

    // ── Weekly Paid Challenges (Coming Soon / Greyed Out) ──
    paidSection: {
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    paidSectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    paidSectionHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    paidSectionTitleGrey: {
      fontSize: 12,
      fontFamily: 'SpaceGroteskBold',
      color: '#52525b',
      letterSpacing: 1.5,
    },
    comingSoonBadge: {
      backgroundColor: 'rgba(63, 63, 70, 0.3)',
      borderWidth: 1,
      borderColor: '#3f3f46',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      overflow: 'hidden',
    },
    comingSoonText: {
      fontSize: 9,
      fontFamily: 'SpaceGroteskBold',
      color: '#71717a',
      letterSpacing: 1.5,
    },
    paidCardGrey: {
      backgroundColor: '#0d0d0f',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: '#1e1e22',
      overflow: 'hidden',
      marginBottom: 10,
    },
    paidCardAccentGrey: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: 4,
      height: '100%',
      backgroundColor: '#27272a',
    },
    paidCardBody: {
      padding: 14,
      paddingLeft: 18,
    },
    paidCardTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 6,
    },
    paidCardTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flex: 1,
      paddingRight: 8,
    },
    paidCardTitleGrey: {
      fontSize: 16,
      fontFamily: 'SpaceGroteskBold',
      color: '#52525b',
      letterSpacing: -0.2,
    },
    paidPillFeeGrey: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(63, 63, 70, 0.15)',
      borderWidth: 1,
      borderColor: '#27272a',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    paidPillFeeTextGrey: {
      fontSize: 10,
      fontFamily: 'SpaceGroteskBold',
      color: '#52525b',
      letterSpacing: 0.5,
    },
    paidCardLift: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 8,
    },
    paidCardLiftTextGrey: {
      fontSize: 10,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#3f3f46',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    paidCardMeta: {
      flexDirection: 'row',
      gap: 14,
      marginBottom: 10,
    },
    paidMetaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    paidMetaValueGrey: {
      fontSize: 11,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#3f3f46',
    },
    paidComingSoonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    paidComingSoonText: {
      fontSize: 11,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#52525b',
    },
  });
}
