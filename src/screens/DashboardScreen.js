import React, { useState, useMemo, useCallback, useEffect } from 'react';
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
import { Analytics } from '../utils/analytics';
import api from '../services/api';
import AvatarFrame from '../components/AvatarFrame';
import PurchaseModal, { BoostSelectModal } from '../components/PurchaseModal';
import * as purchaseService from '../services/purchaseService';
import { PRODUCTS, formatPrice } from '../constants/store';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

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
  const [activeBoost, setActiveBoost] = useState(null);
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [showBoostPurchase, setShowBoostPurchase] = useState(false);
  const [pendingBoost, setPendingBoost] = useState(null);

  useEffect(() => {
    const check = () => setActiveBoost(purchaseService.getActiveBoost());
    check();
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, []);

  const totalPoints = Number(user?.totalPoints || 0);
  const currentTier = getUserTier(totalPoints) || { name: 'Bronze', color: '#FFD700' };
  const tierProgress = getTierProgress(totalPoints) || { percentage: 0, nextTier: null };
  const firstName = (user?.name || user?.username || 'Athlete').split(' ')[0];

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      Analytics.logEvent('app_opened', {});
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
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 100 }}
      >
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerGreeting}>{getGreeting()}</Text>
            <Text style={styles.headerName}>{firstName.toUpperCase()}</Text>
          </View>

          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={() => navigation.navigate('Stats')}
            activeOpacity={0.7}
          >
            <AvatarFrame
              size={52}
              imageUri={user?.profileImage || user?.photoURL}
              fallbackText={firstName.charAt(0).toUpperCase()}
              frameId={purchaseService.getActiveFrame()}
            />
          </TouchableOpacity>
        </View>

        {/* XP Boost Banner */}
        {activeBoost && (
          <View style={styles.boostBanner}>
            <Ionicons name="flash" size={16} color="#FFD700" />
            <Text style={styles.boostBannerText}>1.5X XP ACTIVE</Text>
            <Text style={styles.boostBannerTimer}>
              {Math.max(0, Math.round((new Date(activeBoost.expiresAt) - new Date()) / 60000))}m left
            </Text>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.ctaCard}
            onPress={() => navigation.navigate('Compete')}
            activeOpacity={0.8}
          >
            <View style={styles.ctaContent}>
              <View style={styles.ctaIconWrap}>
                <Ionicons name="trophy" size={22} color="#DC2626" />
              </View>
              <View style={styles.ctaTextWrap}>
                <Text style={styles.ctaLabel}>Join a Challenge</Text>
                <Text style={styles.ctaSub}>Compete and earn points</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#52525b" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.ctaCard}
            onPress={() => navigation.navigate('Leagues')}
            activeOpacity={0.8}
          >
            <View style={styles.ctaContent}>
              <View style={[styles.ctaIconWrap, styles.ctaIconWrapSecondary]}>
                <Ionicons name="barbell-outline" size={22} color="#a1a1aa" />
              </View>
              <View style={styles.ctaTextWrap}>
                <Text style={styles.ctaLabel}>Submit a Lift</Text>
                <Text style={styles.ctaSub}>Get ranked on the leaderboard</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#52525b" />
            </View>
          </TouchableOpacity>

          {/* XP Boost CTA */}
          <TouchableOpacity
            style={styles.ctaCard}
            onPress={() => setShowBoostModal(true)}
            activeOpacity={0.8}
          >
            <View style={styles.ctaContent}>
              <View style={[styles.ctaIconWrap, { backgroundColor: 'rgba(255, 215, 0, 0.08)' }]}>
                <Ionicons name="flash" size={22} color="#FFD700" />
              </View>
              <View style={styles.ctaTextWrap}>
                <Text style={styles.ctaLabel}>XP Boost</Text>
                <Text style={styles.ctaSub}>{activeBoost ? '1.5x active now' : 'Multiply your earnings'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#52525b" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Stats Row — Level & Rank side by side */}
        <View style={styles.statsRow}>
          {/* Level Card */}
          <View style={styles.statCard}>
            <View style={styles.statCardHeader}>
              <Ionicons name="shield-outline" size={13} color="#71717a" />
              <Text style={styles.statCardLabel}>YOUR LEVEL</Text>
            </View>
            <View style={styles.statTierRow}>
              <View style={[styles.tierDot, { backgroundColor: currentTier.color }]} />
              <Text style={styles.statTierName}>{currentTier.name}</Text>
            </View>
            <Text style={styles.statPointsValue}>{totalPoints.toLocaleString()}</Text>
            <Text style={styles.statPointsSub}>points earned</Text>

            {tierProgress.nextTier ? (
              <View style={styles.statProgressSection}>
                <SegmentedBar percentage={tierProgress.percentage} color={currentTier.color} />
                <Text style={styles.statProgressHint}>
                  {tierProgress.percentage.toFixed(0)}% to {tierProgress.nextTier.name}
                </Text>
              </View>
            ) : (
              <Text style={styles.statMaxHint}>MAX LEVEL</Text>
            )}
          </View>

          {/* Rank Card */}
          <TouchableOpacity
            style={styles.statCard}
            onPress={() => navigation.navigate('Leagues')}
            activeOpacity={0.7}
          >
            <View style={styles.statCardHeader}>
              <Ionicons name="podium-outline" size={13} color="#71717a" />
              <Text style={styles.statCardLabel}>YOUR RANK</Text>
            </View>

            {userRank && totalUsers > 0 ? (
              <>
                <Text style={styles.statRankValue}>#{userRank.toLocaleString()}</Text>
                <Text style={styles.statRankOf}>out of {totalUsers.toLocaleString()} athletes</Text>
                <View style={styles.statRankBar}>
                  <View style={[
                    styles.statRankBarFill,
                    { width: `${Math.max(5, 100 - ((userRank / totalUsers) * 100))}%` },
                  ]} />
                </View>
                <Text style={styles.statRankPercentile}>
                  Top {Math.max(1, Math.round((userRank / totalUsers) * 100))}%
                </Text>
              </>
            ) : (
              <>
                <View style={styles.statRankEmpty}>
                  <Ionicons name="barbell-outline" size={20} color="#3f3f46" />
                </View>
                <Text style={styles.statRankEmptyText}>Submit a lift to{'\n'}get ranked</Text>
              </>
            )}

            <View style={styles.statCardFooter}>
              <Text style={styles.statCardFooterText}>View Leaderboard</Text>
              <Ionicons name="chevron-forward" size={12} color="#DC2626" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Challenges Section */}
        <View style={styles.sectionHeader}>
          <Ionicons name="flash-outline" size={15} color="#DC2626" />
          <Text style={styles.sectionTitle}>CHALLENGES</Text>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabNav}>
          <TouchableOpacity
            style={styles.tabBtn}
            onPress={() => setActiveTab('upcoming')}
            activeOpacity={0.7}
          >
            <View style={styles.tabBtnRow}>
              <Ionicons name="calendar-outline" size={13} color={activeTab === 'upcoming' ? '#fafafa' : '#71717a'} />
              <Text style={[styles.tabBtnText, activeTab === 'upcoming' && styles.tabBtnTextActive]}>
                Active
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
            <View style={styles.tabBtnRow}>
              <Ionicons name="checkmark-done-outline" size={13} color={activeTab === 'past' ? '#fafafa' : '#71717a'} />
              <Text style={[styles.tabBtnText, activeTab === 'past' && styles.tabBtnTextActive]}>
                Finished
              </Text>
            </View>
            {activeTab === 'past' && <View style={styles.tabIndicatorGray} />}
          </TouchableOpacity>
        </View>

        {/* Challenge List */}
        <View style={styles.challengeList}>
          {displayChallenges.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="flag-outline" size={24} color="#52525b" />
              </View>
              <Text style={styles.emptyTitle}>
                {activeTab === 'upcoming' ? 'No active challenges' : 'No finished challenges yet'}
              </Text>
              {activeTab === 'upcoming' && (
                <TouchableOpacity
                  style={styles.emptyAction}
                  onPress={() => navigation.navigate('Compete')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trophy-outline" size={14} color="#DC2626" />
                  <Text style={styles.emptyActionText}>Browse Challenges</Text>
                </TouchableOpacity>
              )}
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

      {/* XP Boost Selection */}
      <BoostSelectModal
        visible={showBoostModal}
        onClose={() => setShowBoostModal(false)}
        onSelect={(boost) => {
          setPendingBoost(boost);
          setShowBoostModal(false);
          setShowBoostPurchase(true);
        }}
      />

      {/* XP Boost Purchase Confirmation */}
      <PurchaseModal
        visible={showBoostPurchase}
        onClose={() => { setShowBoostPurchase(false); setPendingBoost(null); }}
        product={{
          name: pendingBoost ? pendingBoost.name : '',
          description: pendingBoost?.description,
          price: pendingBoost?.price,
        }}
        onPurchaseComplete={async () => {
          if (!pendingBoost) return;
          await purchaseService.purchaseXpBoost(pendingBoost.id, pendingBoost.price, pendingBoost.durationHours, pendingBoost.multiplier);
          setActiveBoost(purchaseService.getActiveBoost());
          setShowBoostPurchase(false);
          setPendingBoost(null);
        }}
      />
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
      <View style={[styles.cardAccent, { backgroundColor: accentColor }]} />

      <View style={styles.cardBody}>
        {/* Title row */}
        <View style={styles.cardTop}>
          <Text style={styles.cardTitle}>{challenge.title || 'Challenge'}</Text>

          {isPast ? (
            <View style={styles.pillEnded}>
              <Ionicons name="checkmark" size={10} color="#71717a" />
              <Text style={styles.pillEndedText}>Done</Text>
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
            <View style={styles.metaIconRow}>
              <Ionicons name="time-outline" size={12} color="#a1a1aa" />
              <Text style={styles.metaLabel}>{!isPast ? 'Time left' : 'Ended'}</Text>
            </View>
            <Text style={styles.metaValue}>
              {!isPast && endDate ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''}` : isPast && endDate ? endDate.toLocaleDateString() : 'N/A'}
            </Text>
          </View>

          {/* Reward */}
          {challenge.reward ? (
            <View style={styles.metaBlock}>
              <View style={styles.metaIconRow}>
                <Ionicons name="star-outline" size={12} color="#FFD700" />
                <Text style={styles.metaLabel}>Reward</Text>
              </View>
              <Text style={styles.metaReward}>+{challenge.reward} pts</Text>
            </View>
          ) : null}

          {/* Progress */}
          {challenge.joined && !isPast && challenge.progress !== undefined ? (
            <View style={[styles.metaBlock, styles.metaBlockProgress]}>
              <View style={styles.progressRow}>
                <View style={styles.metaIconRow}>
                  <Ionicons name="flame" size={12} color="#DC2626" />
                  <Text style={styles.metaLabelProgress}>Progress</Text>
                </View>
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
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    marginBottom: 20,
  },
  headerLeft: {
    flex: 1,
  },
  headerGreeting: {
    fontSize: 13,
    fontFamily: 'SpaceGroteskSemiBold',
    color: '#71717a',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  headerName: {
    fontSize: 28,
    fontWeight: '900',
    fontFamily: 'SpaceGroteskBold',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarFrame: {
    width: 52,
    height: 52,
    borderWidth: 2,
    borderColor: '#27272a',
    backgroundColor: '#18181b',
    padding: 3,
    borderRadius: 14,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  avatarFallbackInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#27272a',
    borderRadius: 10,
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'SpaceGroteskBold',
    color: '#fff',
  },

  // Quick Actions
  quickActions: {
    flexDirection: 'column',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
  },

  // XP Boost Banner
  boostBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 215, 0, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
    borderRadius: 12,
  },
  boostBannerText: {
    fontSize: 11,
    fontFamily: 'SpaceGroteskBold',
    color: '#FFD700',
    letterSpacing: 1,
    flex: 1,
  },
  boostBannerTimer: {
    fontSize: 11,
    fontFamily: 'SpaceGroteskSemiBold',
    color: '#FFD700',
  },

  // CTA Card
  ctaCard: {
    backgroundColor: '#121214',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272a',
  },

  // Content
  ctaContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    position: 'relative',
    zIndex: 1,
  },
  ctaIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaIconWrapSecondary: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  ctaTextWrap: {
    flex: 1,
  },
  ctaLabel: {
    fontSize: 15,
    fontFamily: 'SpaceGroteskBold',
    color: '#fafafa',
    letterSpacing: -0.2,
  },
  ctaSub: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk',
    color: '#71717a',
    marginTop: 2,
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#27272a',
    backgroundColor: '#121214',
    borderRadius: 14,
    padding: 14,
  },
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 10,
  },
  statCardLabel: {
    fontSize: 10,
    fontFamily: 'SpaceGroteskSemiBold',
    color: '#71717a',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  statTierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  tierDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statTierName: {
    fontSize: 16,
    fontFamily: 'SpaceGroteskBold',
    fontWeight: '700',
    color: '#fafafa',
    letterSpacing: -0.3,
  },
  statPointsValue: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: 'SpaceGroteskBold',
    color: '#fafafa',
    letterSpacing: -1,
  },
  statPointsSub: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk',
    color: '#71717a',
    marginTop: 2,
  },
  statProgressSection: {
    marginTop: 12,
  },
  segBarRow: {
    flexDirection: 'row',
    gap: 2,
    height: 8,
  },
  segBarSegment: {
    flex: 1,
    borderRadius: 1,
    transform: [{ skewX: '-15deg' }],
  },
  statProgressHint: {
    fontSize: 10,
    fontFamily: 'SpaceGroteskSemiBold',
    color: '#71717a',
    marginTop: 6,
  },
  statMaxHint: {
    fontSize: 10,
    fontFamily: 'SpaceGroteskBold',
    color: '#FFD700',
    letterSpacing: 1,
    marginTop: 8,
  },
  statRankValue: {
    fontSize: 28,
    fontWeight: '700',
    fontFamily: 'SpaceGroteskBold',
    color: '#fafafa',
    letterSpacing: -1.5,
    marginBottom: 2,
  },
  statRankOf: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk',
    color: '#71717a',
    marginBottom: 10,
  },
  statRankBar: {
    height: 4,
    backgroundColor: '#27272a',
    borderRadius: 99,
    overflow: 'hidden',
    marginBottom: 4,
  },
  statRankBarFill: {
    height: '100%',
    backgroundColor: '#DC2626',
    borderRadius: 99,
  },
  statRankPercentile: {
    fontSize: 11,
    fontFamily: 'SpaceGroteskBold',
    color: '#DC2626',
    fontWeight: '700',
  },
  statRankEmpty: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statRankEmptyText: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk',
    color: '#71717a',
    lineHeight: 16,
  },
  statCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#27272a',
  },
  statCardFooterText: {
    fontSize: 10,
    fontFamily: 'SpaceGroteskSemiBold',
    color: '#DC2626',
    letterSpacing: 0.5,
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'SpaceGroteskBold',
    color: '#a1a1aa',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  // Tab Navigation
  tabNav: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
    marginBottom: 4,
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
    marginLeft: 2,
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
    marginTop: 8,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
  metaIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 13,
    fontFamily: 'SpaceGroteskSemiBold',
    color: '#a1a1aa',
    letterSpacing: 0.3,
    marginBottom: 16,
  },
  emptyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyActionText: {
    fontSize: 12,
    fontFamily: 'SpaceGroteskSemiBold',
    color: '#DC2626',
    letterSpacing: 0.5,
  },
});
