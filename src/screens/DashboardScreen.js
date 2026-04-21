import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { getUserTier, getTierProgress } from '../constants/tiers';
import api from '../services/api';

// --- Segmented Progress Bar ---
function SegmentedBar({ percentage, color }) {
  const totalSegments = 24;
  const activeSegments = Math.round((Math.min(100, percentage) / 100) * totalSegments);

  return (
    <View style={styles.segBarRow}>
      {Array.from({ length: totalSegments }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.segBarSegment,
            {
              backgroundColor: i < activeSegments ? color : 'rgba(255,255,255,0.05)',
              shadowColor: i < activeSegments ? color : 'transparent',
              shadowOpacity: i < activeSegments ? 0.18 : 0,
              shadowRadius: 4,
            },
          ]}
        />
      ))}
    </View>
  );
}

export default function DashboardScreen({ navigation }) {
  const { user } = useApp();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState('upcoming');
  const [challenges, setChallenges] = useState([]);
  const [userRank, setUserRank] = useState(null);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);

  const totalPoints = Number(user?.totalPoints || 0);
  const currentTier = getUserTier(totalPoints) || { name: 'Bronze', color: '#FFD700' };
  const tierProgress = getTierProgress(totalPoints) || { percentage: 0, nextTier: null };

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let active = true;
      (async () => {
        try {
          setLoading(true);
          const res = await api.getChallenges({ includeExpired: 'true' });
          if (!active) return;
          setChallenges(Array.isArray(res?.data) ? res.data : Array.isArray(res?.data?.challenges) ? res.data.challenges : []);
        } catch {
          setChallenges([]);
        } finally {
          if (active) setLoading(false);
        }
      })();

      (async () => {
        try {
          const res = await api.getCoreLiftLeaderboard({ gender: user?.gender, limit: 1 });
          if (!active) return;
          const data = res?.data || res;
          const cur = data?.currentUser || null;
          if (cur?.rank) setUserRank(cur.rank);
          const board = data?.leaderboard || [];
          const total = data?.totalUsers || data?.total || 0;
          setTotalUsers(total > 0 ? total : board.length);
        } catch {
          setUserRank(null);
          setTotalUsers(0);
        }
      })();
      return () => { active = false; };
    }, [user?.id])
  );

  const now = new Date();

  const upcomingChallenges = useMemo(() =>
    challenges.filter(c => c?.id && new Date(c.endDate) > now && c.isActive !== false)
      .sort((a, b) => new Date(a.endDate) - new Date(b.endDate)),
    [challenges]
  );

  const pastChallenges = useMemo(() =>
    challenges.filter(c => c?.id && (new Date(c.endDate) <= now || c.isActive === false))
      .sort((a, b) => new Date(b.endDate) - new Date(a.endDate)),
    [challenges]
  );

  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#DC2626" />
      </View>
    );
  }

  const displayChallenges = activeTab === 'upcoming' ? upcomingChallenges : pastChallenges;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: 100 }}
      >
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerName}>
              {(user?.name || user?.username || 'Athlete').split(' ')[0].toUpperCase()}
            </Text>
            <Text style={styles.headerSub}>
              Rank: <Text style={{ color: currentTier.color, fontWeight: '700' }}>{currentTier.name}</Text>
            </Text>
          </View>

          <View style={styles.avatarContainer}>
            <View style={styles.avatarCrossTL} />
            <View style={styles.avatarCrossBR} />
            <View style={styles.avatarFrame}>
              {(user?.profileImage || user?.photoURL) ? (
                <Image source={{ uri: user.profileImage || user.photoURL }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarFallbackInner}>
                  <Text style={styles.avatarInitial}>
                    {(user?.name || user?.username || 'A').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Telemetry Grid — Rank & Leaderboard */}
        <View style={styles.telemetryGrid}>

          {/* Main Stats Block */}
          <View style={styles.statsBlock}>
            <Text style={styles.monoLabel}>Total Points</Text>
            <View style={styles.pointsRow}>
              <Text style={styles.pointsValue}>{totalPoints.toLocaleString()}</Text>
              <Text style={styles.pointsUnit}>PTS</Text>
            </View>

            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={styles.monoLabel}>Rank Progress</Text>
                <Text style={styles.monoValue}>
                  {tierProgress.nextTier ? `${tierProgress.percentage.toFixed(0)}%` : 'MAX'}
                </Text>
              </View>
              <SegmentedBar percentage={tierProgress.percentage} color={currentTier.color} />
              <View style={styles.tierLabels}>
                <Text style={styles.tierLabelSmall}>Current: {currentTier.name}</Text>
                <Text style={styles.tierLabelSmall}>Next: {tierProgress.nextTier ? tierProgress.nextTier.name : 'N/A'}</Text>
              </View>
            </View>
          </View>

          {/* Leaderboard Block */}
          <TouchableOpacity
            style={styles.leaderboardBlock}
            onPress={() => navigation.navigate('CoreLiftLeaderboard')}
            activeOpacity={0.7}
          >
            <View style={styles.lbAccent} />
            <View style={styles.lbContent}>
              <View style={styles.lbHeader}>
                <Ionicons name="locate" size={16} color="#a1a1aa" />
                <Text style={styles.monoLabel}>Global Leaderboard</Text>
              </View>

              {userRank && totalUsers > 0 ? (
                <>
                  <View style={styles.lbRankRow}>
                    <Text style={styles.lbRankValue}>#{userRank.toLocaleString()}</Text>
                    <Text style={styles.lbRankOf}>/ {totalUsers.toLocaleString()}</Text>
                  </View>

                  <View style={styles.lbDivider}>
                    <View style={styles.lbDividerLine} />
                  </View>

                  <View style={styles.lbPercentileRow}>
                    <Text style={styles.monoLabel}>Top Percentile</Text>
                    <Text style={styles.lbPercentileValue}>
                      Top {Math.max(1, Math.round((userRank / totalUsers) * 100))}%
                    </Text>
                  </View>
                </>
              ) : (
                <View style={styles.lbEmpty}>
                  <Text style={styles.lbEmptyText}>Complete a core lift to rank</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabNav}>
          <TouchableOpacity
            style={styles.tabBtn}
            onPress={() => setActiveTab('upcoming')}
            activeOpacity={0.7}
          >
            <View style={styles.tabBtnRow}>
              <Text style={[styles.tabBtnText, activeTab === 'upcoming' && styles.tabBtnTextActive]}>
                Upcoming
              </Text>
              {upcomingChallenges.length > 0 && (
                <View style={styles.tabBadgeRed}>
                  <Text style={styles.tabBadgeRedText}>{upcomingChallenges.length}</Text>
                </View>
              )}
            </View>
            {activeTab === 'upcoming' && <View style={styles.tabIndicator} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tabBtn}
            onPress={() => setActiveTab('past')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabBtnText, activeTab === 'past' && styles.tabBtnTextActive]}>
              Past
            </Text>
            {activeTab === 'past' && <View style={styles.tabIndicatorGray} />}
          </TouchableOpacity>
        </View>

        {/* Challenge List */}
        <View style={styles.challengeList}>
          {displayChallenges.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="flag-outline" size={24} color="#555" />
              <Text style={styles.emptyText}>
                {activeTab === 'upcoming' ? 'NO UPCOMING CHALLENGES' : 'NO PAST CHALLENGES'}
              </Text>
            </View>
          ) : (
            displayChallenges.map((challenge) => (
              <ChallengeCard
                key={challenge.id}
                challenge={challenge}
                isPast={activeTab === 'past'}
                onPress={() => navigation.navigate('ChallengeDetail', { challengeId: challenge.id })}
              />
            ))
          )}
        </View>

      </ScrollView>
    </View>
  );
}

// --- Challenge Card ---
function ChallengeCard({ challenge, isPast, onPress }) {
  const endDate = challenge.endDate ? new Date(challenge.endDate) : null;
  const daysLeft = endDate ? Math.max(0, Math.ceil((endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))) : 0;

  const accentColor = isPast ? '#333' : challenge.joined ? '#DC2626' : '#555';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      {/* Accent Line */}
      <View style={[styles.cardAccent, { backgroundColor: accentColor }]} />

      <View style={styles.cardBody}>
        {/* Title row */}
        <View style={styles.cardTop}>
          <Text style={styles.cardTitle}>{challenge.title || 'Challenge'}</Text>

          {isPast ? (
            <View style={styles.pillEnded}>
              <Text style={styles.pillEndedText}>Ended</Text>
            </View>
          ) : challenge.joined ? (
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

        {/* Description */}
        {challenge.description ? (
          <Text style={styles.cardDesc} numberOfLines={2}>{challenge.description}</Text>
        ) : null}

        {/* Meta footer */}
        <View style={styles.cardFooter}>
          {/* Time */}
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>
              <Ionicons name="time-outline" size={12} color="#a1a1aa" /> Time Left
            </Text>
            <Text style={styles.metaValue}>
              {!isPast && endDate ? `${daysLeft} Days` : isPast && endDate ? endDate.toLocaleDateString() : 'N/A'}
            </Text>
          </View>

          {/* Reward */}
          {challenge.reward ? (
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>
                <Ionicons name="star" size={12} color="#a1a1aa" /> Reward
              </Text>
              <Text style={styles.metaReward}>{challenge.reward} PTS</Text>
            </View>
          ) : null}

          {/* Progress */}
          {challenge.joined && !isPast && challenge.progress !== undefined ? (
            <View style={[styles.metaBlock, styles.metaBlockProgress]}>
              <View style={styles.progressRow}>
                <Text style={styles.metaLabelProgress}>
                  <Ionicons name="flame" size={12} color="#DC2626" /> Progress
                </Text>
                <Text style={styles.progressPercent}>{Math.round(challenge.progress)}%</Text>
              </View>
              <View style={styles.progressBarOuter}>
                <View style={[styles.progressBarFill, { width: `${challenge.progress}%` }]} />
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#09090b',
  },
  scroll: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 12,
    marginBottom: 8,
  },
  headerLeft: {
    flex: 1,
  },
  headerName: {
    fontSize: 28,
    fontWeight: '900',
    fontFamily: 'SpaceGroteskBold',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 13,
    fontFamily: 'SpaceGroteskSemiBold',
    color: '#a1a1aa',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarCrossTL: {
    position: 'absolute',
    top: -3,
    left: -3,
    width: 8,
    height: 8,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderColor: '#DC2626',
    zIndex: 2,
  },
  avatarCrossBR: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 8,
    height: 8,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: '#DC2626',
    zIndex: 2,
  },
  avatarFrame: {
    width: 64,
    height: 64,
    borderWidth: 2,
    borderColor: '#27272a',
    backgroundColor: '#18181b',
    padding: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  avatarFallbackInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#27272a',
    borderRadius: 8,
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'SpaceGroteskBold',
    color: '#fff',
  },

  // Telemetry Grid
  telemetryGrid: {
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  statsBlock: {
    borderWidth: 1,
    borderColor: '#27272a',
    backgroundColor: '#121214',
    padding: 16,
    borderRadius: 12,
  },
  monoLabel: {
    fontSize: 11,
    fontFamily: 'SpaceGroteskSemiBold',
    color: '#71717a',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  monoValue: {
    fontSize: 12,
    fontFamily: 'SpaceGroteskSemiBold',
    color: '#d4d4d8',
    letterSpacing: 0.5,
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 4,
  },
  pointsValue: {
    fontSize: 36,
    fontWeight: '700',
    fontFamily: 'SpaceGroteskBold',
    color: '#fff',
    letterSpacing: -1.5,
  },
  pointsUnit: {
    fontSize: 14,
    fontFamily: 'SpaceGroteskBold',
    color: '#DC2626',
    fontWeight: '700',
  },
  progressSection: {
    marginTop: 20,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  segBarRow: {
    flexDirection: 'row',
    gap: 2,
    height: 12,
  },
  segBarSegment: {
    flex: 1,
    borderRadius: 1,
    transform: [{ skewX: '-15deg' }],
  },
  tierLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  tierLabelSmall: {
    fontSize: 10,
    fontFamily: 'SpaceGroteskSemiBold',
    color: '#71717a',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Leaderboard Block
  leaderboardBlock: {
    borderWidth: 1,
    borderColor: '#27272a',
    backgroundColor: '#121214',
    borderRadius: 12,
    overflow: 'hidden',
  },
  lbAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 5,
    height: '100%',
    backgroundColor: '#27272a',
  },
  lbContent: {
    paddingLeft: 16,
    padding: 16,
  },
  lbHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  lbRankRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  lbRankValue: {
    fontSize: 32,
    fontWeight: '700',
    fontFamily: 'SpaceGroteskBold',
    color: '#fff',
    letterSpacing: -1.5,
  },
  lbRankOf: {
    fontSize: 12,
    fontFamily: 'SpaceGroteskSemiBold',
    color: '#71717a',
  },
  lbDivider: {
    marginTop: 16,
  },
  lbDividerLine: {
    borderTopWidth: 1,
    borderTopColor: '#27272a',
  },
  lbPercentileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  lbPercentileValue: {
    fontSize: 12,
    fontFamily: 'SpaceGroteskBold',
    color: '#DC2626',
    fontWeight: '700',
  },
  lbEmpty: {
    paddingVertical: 12,
  },
  lbEmptyText: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk',
    color: '#71717a',
  },

  // Tab Navigation
  tabNav: {
    flexDirection: 'row',
    marginTop: 24,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  tabBtn: {
    paddingBottom: 12,
    paddingHorizontal: 12,
    position: 'relative',
    marginRight: 4,
  },
  tabBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabBtnText: {
    fontSize: 12,
    fontFamily: 'SpaceGroteskSemiBold',
    color: '#71717a',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  tabBtnTextActive: {
    color: '#fff',
  },
  tabBadgeRed: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 6,
    borderRadius: 6,
  },
  tabBadgeRedText: {
    fontSize: 9,
    fontFamily: 'SpaceGroteskBold',
    color: '#fff',
    fontWeight: '700',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#DC2626',
  },
  tabIndicatorGray: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#d4d4d8',
  },

  // Challenge List
  challengeList: {
    paddingHorizontal: 16,
    gap: 12,
    marginTop: 12,
  },

  // Challenge Card
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
  },
  cardBody: {
    padding: 16,
    paddingLeft: 20,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'SpaceGroteskBold',
    color: '#fafafa',
    letterSpacing: -0.3,
    flex: 1,
    paddingRight: 12,
  },

  // Status Pills
  pillEnded: {
    borderWidth: 1,
    borderColor: '#27272a',
    backgroundColor: '#18181b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pillEndedText: {
    fontSize: 10,
    fontFamily: 'SpaceGroteskSemiBold',
    color: '#71717a',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  pillJoined: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,45,85,0.3)',
    backgroundColor: 'rgba(255,45,85,0.1)',
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
    letterSpacing: 1,
    textTransform: 'uppercase',
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
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  cardDesc: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk',
    color: '#a1a1aa',
    lineHeight: 20,
    marginBottom: 12,
  },

  // Card Footer
  cardFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: 1,
    borderTopColor: '#27272a',
    paddingTop: 12,
    gap: 24,
  },
  metaBlock: {
    gap: 4,
  },
  metaBlockProgress: {
    flex: 1,
    minWidth: 120,
  },
  metaLabel: {
    fontSize: 10,
    fontFamily: 'SpaceGroteskSemiBold',
    color: '#71717a',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: 12,
    fontFamily: 'SpaceGroteskSemiBold',
    color: '#e4e4e7',
    letterSpacing: 0.3,
  },
  metaReward: {
    fontSize: 12,
    fontFamily: 'SpaceGroteskSemiBold',
    color: '#FFD700',
    letterSpacing: 0.3,
  },
  metaLabelProgress: {
    fontSize: 10,
    fontFamily: 'SpaceGroteskSemiBold',
    color: '#DC2626',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressPercent: {
    fontSize: 10,
    fontFamily: 'SpaceGroteskSemiBold',
    color: '#d4d4d8',
  },
  progressBarOuter: {
    height: 6,
    backgroundColor: '#27272a',
    borderRadius: 99,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#DC2626',
    borderRadius: 99,
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
  emptyText: {
    fontSize: 11,
    fontFamily: 'SpaceGroteskSemiBold',
    color: '#71717a',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 12,
  },
});
