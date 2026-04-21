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

const LIFT_FILTERS = [{ id: null, label: 'All' }, ...COMPETITIVE_LIFTS.map((lift) => ({
  id: lift.id,
  label: lift.label,
}))];

export default function CompeteScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const { theme } = useTheme();
  const { alertConfig, showAlert, hideAlert } = useCustomAlert();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [challenges, setChallenges] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState('active');
  const [selectedLift, setSelectedLift] = useState(null);
  const [joining, setJoining] = useState(null);

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
    loadChallenges();
  }, [selectedFilter, selectedLift]);

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
        const filtered = (response.data || []).filter((challenge) => {
          const liftId = getChallengeLiftId(challenge);
          if (!(selectedLift ? liftId === selectedLift : !!liftId)) {
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
          {LIFT_FILTERS.map((lift) => {
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
  });
}
