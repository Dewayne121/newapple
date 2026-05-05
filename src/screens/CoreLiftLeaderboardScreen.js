import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { COMPETITIVE_LIFTS, resolveCompetitiveLiftId } from '../constants/competitiveLifts';
import api from '../services/api';
import * as purchaseService from '../services/purchaseService';

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
  return { color: '#a1a1aa' };
};

export default function CoreLiftLeaderboardScreen({ route }) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user, weightUnit } = useApp();

  const requestedLift = useMemo(
    () => resolveCompetitiveLiftId(route?.params?.exerciseId || route?.params?.exercise),
    [route?.params?.exerciseId, route?.params?.exercise]
  );

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserRank, setCurrentUserRank] = useState(null);

  const [selectedLift, setSelectedLift] = useState(requestedLift || 'bench_press');
  const [selectedWeightClass, setSelectedWeightClass] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState('Global');
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  // Reset lift if it's invalid for current location
  useEffect(() => {
    const visible = getLiftsForLocation(selectedLocation);
    if (visible.length > 0 && !visible.find(l => l.id === selectedLift)) {
      setSelectedLift(visible[0].id);
    }
  }, [selectedLocation]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        liftType: selectedLift,
        weightClass: selectedWeightClass,
        region: selectedRegion,
        locationType: selectedLocation,
        gender: user?.gender,
        limit: 100,
      };

      const response = await api.getCoreLiftLeaderboard(params);

      if (response.success && response.data) {
        setEntries(response.data.leaderboard || []);
        setCurrentUserRank(response.data.currentUser);
      }
    } catch (error) {
      console.error('Error fetching core lift leaderboard:', error);
      setEntries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedLift, selectedWeightClass, selectedRegion, selectedLocation, user]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const format1RM = (valueKg) => {
    const value = Number(valueKg) || 0;
    if (value <= 0) return '--';
    if (weightUnit === 'lbs') return `${Math.round(value * 2.20462)} lb`;
    return `${value.toFixed(1)} kg`;
  };

  const selectedLiftObj = COMPETITIVE_LIFTS.find(l => l.id === selectedLift) || COMPETITIVE_LIFTS[0];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#DC2626" />
      </View>
    );
  }

  const topThree = entries.slice(0, 3);
  const restEntries = entries.slice(3);
  const currentUserVisible = entries.some(e => e.userId === user?.id);
  const showStickyUser = currentUserRank?.rank && !currentUserVisible;

  return (
    <View style={styles.page}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={20} color="#fafafa" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>CORE LIFTS</Text>
            <Text style={styles.headerSub}>
              {selectedLiftObj.label.toUpperCase()} / {selectedRegion.toUpperCase()} / {(selectedLocation || 'ALL').toUpperCase()}
            </Text>
          </View>
          <View style={styles.headerStats}>
            <Text style={styles.headerStatValue}>{entries.length}</Text>
            <Text style={styles.headerStatLabel}>ATHLETES</Text>
          </View>
        </View>

        {/* Location Toggle */}
        <View style={styles.locationToggleWrap}>
          {LOCATION_TABS.map((tab) => {
            const isActive = selectedLocation === tab.key;
            return (
              <TouchableOpacity
                key={tab.key ?? 'all'}
                style={[styles.locationTab, isActive && styles.locationTabActive]}
                onPress={() => setSelectedLocation(tab.key)}
                activeOpacity={0.7}
              >
                <Ionicons name={tab.icon} size={14} color={isActive ? '#fafafa' : '#71717a'} />
                <Text style={[styles.locationTabText, isActive && styles.locationTabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Actions Row */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setShowFilters(prev => !prev)}
            activeOpacity={0.85}
          >
            <Ionicons name={showFilters ? 'options' : 'options-outline'} size={14} color="#a1a1aa" />
            <Text style={styles.actionBtnText}>{showFilters ? 'HIDE FILTERS' : 'FILTERS'}</Text>
          </TouchableOpacity>
        </View>

        {/* Collapsible Filters */}
        {showFilters && (
          <View style={styles.filtersWrap}>
            {/* Lift */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>LIFT</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                {getLiftsForLocation(selectedLocation).map(lift => (
                  <TouchableOpacity
                    key={lift.id}
                    style={[styles.filterPill, selectedLift === lift.id && styles.filterPillActive]}
                    onPress={() => setSelectedLift(lift.id)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.filterPillText, selectedLift === lift.id && styles.filterPillTextActive]}>
                      {lift.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Weight Class */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>WEIGHT CLASS</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                {WEIGHT_CLASSES.map(wc => (
                  <TouchableOpacity
                    key={wc.id || 'all'}
                    style={[styles.filterPill, selectedWeightClass === wc.id && styles.filterPillActive]}
                    onPress={() => setSelectedWeightClass(wc.id)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.filterPillText, selectedWeightClass === wc.id && styles.filterPillTextActive]}>
                      {wc.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Region */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>REGION</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                {REGIONS.map(region => (
                  <TouchableOpacity
                    key={region.id}
                    style={[styles.filterPill, selectedRegion === region.id && styles.filterPillActive]}
                    onPress={() => setSelectedRegion(region.id)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.filterPillText, selectedRegion === region.id && styles.filterPillTextActive]}>
                      {region.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        )}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#DC2626" />}
      >
        <View style={styles.listContainer}>
          {entries.length === 0 && (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="barbell-outline" size={24} color="#52525b" />
              </View>
              <Text style={styles.emptyTitle}>No entries yet</Text>
              <Text style={styles.emptySub}>Submit a verified lift to get ranked</Text>
            </View>
          )}

          {/* Podium Section */}
          {topThree.length > 0 && (
            <View style={styles.podiumSection}>
              <Text style={styles.podiumLabel}>TOP CONTENDERS</Text>
              {topThree.map((item) => {
                const medalColor = item.rank === 1 ? '#FFD700' : item.rank === 2 ? '#C0C0D0' : '#CD7F32';
                const isCurrentUser = user && item.userId === user.id;
                const isHighlighted = isCurrentUser && purchaseService.hasRankHighlight();
                return (
                  <TouchableOpacity
                    key={item.userId}
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
                    onPress={() => navigation.navigate('Profile', { userId: item.userId })}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.podiumColorBar, { backgroundColor: medalColor }]} />
                    <View style={styles.podiumCardContent}>
                      <Text style={[styles.podiumRankNumber, { color: medalColor }]}>{item.rank}</Text>
                      <View style={styles.podiumInfo}>
                        <View style={styles.podiumProfileRow}>
                          {item.profileImage ? (
                            <Image source={{ uri: item.profileImage }} style={styles.podiumAvatar} />
                          ) : (
                            <View style={styles.podiumAvatarFallback}>
                              <Text style={styles.podiumAvatarText}>
                                {(item.name || 'U').substring(0, 2).toUpperCase()}
                              </Text>
                            </View>
                          )}
                          <Text style={styles.podiumName} numberOfLines={1}>{item.name || 'Unknown'}</Text>
                        </View>
                      </View>
                      <View style={styles.podiumRight}>
                        <Text style={styles.podiumLiftValue}>{format1RM(item.estimated1RM)}</Text>
                        <View style={[
                          styles.locPill,
                          { backgroundColor: item.locationType === 'home' ? 'rgba(220, 38, 38, 0.1)' : 'rgba(113, 113, 122, 0.1)' },
                        ]}>
                          <Ionicons
                            name={item.locationType === 'home' ? 'home-outline' : 'business-outline'}
                            size={9}
                            color={item.locationType === 'home' ? '#DC2626' : '#71717a'}
                          />
                          <Text style={[
                            styles.locPillText,
                            { color: item.locationType === 'home' ? '#DC2626' : '#71717a' },
                          ]}>
                            {item.locationType === 'home' ? 'Home' : 'Gym'}
                          </Text>
                        </View>
                      </View>
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
          )}

          {/* Rank List */}
          {(topThree.length >= 3 ? restEntries : entries).map((item) => {
            const actualRank = topThree.length >= 3 ? item.rank : item.rank;
            const isCurrentUser = user && item.userId === user.id;
            const isHighlighted = isCurrentUser && purchaseService.hasRankHighlight();
            return (
              <TouchableOpacity
                key={item.userId}
                onPress={() => navigation.navigate('Profile', { userId: item.userId })}
                activeOpacity={0.7}
                style={[
                  styles.rankCard,
                  isCurrentUser && styles.rankCardCurrentUser,
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
                <View style={[styles.rankCardBar, { backgroundColor: isCurrentUser ? '#DC2626' : '#27272a' }]} />
                <Text style={[styles.rankNumber, getRankStyle(actualRank)]}>{actualRank}</Text>

                <View style={styles.rankProfileSection}>
                  {item.profileImage ? (
                    <Image source={{ uri: item.profileImage }} style={styles.rankAvatar} />
                  ) : (
                    <View style={styles.rankAvatarFallback}>
                      <Text style={styles.rankAvatarText}>{(item.name || 'U').substring(0, 2).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={styles.rankNameWrap}>
                    <Text style={styles.rankName} numberOfLines={1}>{item.name || 'Unknown'}</Text>
                    {isCurrentUser && (
                      <View style={styles.youPill}>
                        <Text style={styles.youPillText}>YOU</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.rankRightCol}>
                  <View style={[styles.locDot, { backgroundColor: item.locationType === 'home' ? '#DC2626' : '#3f3f46' }]} />
                  <View style={styles.rankValuePill}>
                    <Text style={[styles.rankValueText, isCurrentUser && { color: '#DC2626' }]}>
                      {format1RM(item.estimated1RM)}
                    </Text>
                  </View>
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
      {showStickyUser && (
        <View style={[styles.stickyRankContainer, { paddingBottom: insets.bottom + 10 }]}>
          <View style={styles.stickyDividerRow}>
            <View style={styles.stickyDividerLine} />
            <Text style={styles.stickyDividerText}>YOUR RANK</Text>
            <View style={styles.stickyDividerLine} />
          </View>
          <TouchableOpacity
            style={styles.stickyRankCard}
            activeOpacity={0.7}
          >
            <View style={[styles.rankCardBar, { backgroundColor: '#DC2626' }]} />
            <Text style={[styles.rankNumber, { color: '#DC2626' }]}>{currentUserRank.rank || '--'}</Text>
            <View style={styles.rankProfileSection}>
              <View style={[styles.rankAvatarFallback, { backgroundColor: '#DC2626', borderColor: '#DC2626' }]}>
                <Text style={[styles.rankAvatarText, { color: '#fafafa' }]}>
                  {(user?.name || 'U').substring(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={styles.rankNameWrap}>
                <Text style={styles.rankName}>You</Text>
              </View>
            </View>
            <View style={styles.rankRightCol}>
              <View style={styles.rankValuePill}>
                <Text style={[styles.rankValueText, { color: '#DC2626' }]}>
                  {format1RM(currentUserRank.estimated1RM)}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#09090b',
  },

  // --- Header ---
  header: {
    paddingHorizontal: 16,
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
    backgroundColor: '#09090b',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#121214',
    borderWidth: 1,
    borderColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    fontFamily: 'SpaceGroteskBold',
    color: '#fafafa',
    letterSpacing: 1,
  },
  headerSub: {
    fontSize: 10,
    fontFamily: 'SpaceGroteskSemiBold',
    color: '#71717a',
    letterSpacing: 1,
    marginTop: 2,
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
    marginTop: 2,
  },

  // --- Location Toggle ---
  locationToggleWrap: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
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

  // --- Actions Row ---
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  actionBtn: {
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
  actionBtnText: {
    fontSize: 10,
    fontFamily: 'SpaceGroteskSemiBold',
    color: '#a1a1aa',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // --- Filters ---
  filtersWrap: {
    paddingBottom: 8,
  },
  filterSection: {
    marginTop: 8,
    marginBottom: 4,
  },
  filterLabel: {
    fontSize: 10,
    fontFamily: 'SpaceGroteskSemiBold',
    color: '#71717a',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  filterScroll: {
    paddingRight: 20,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#121214',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  filterPillActive: {
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
    borderColor: '#DC2626',
  },
  filterPillText: {
    fontSize: 11,
    fontFamily: 'SpaceGroteskSemiBold',
    color: '#71717a',
    letterSpacing: 0.5,
  },
  filterPillTextActive: {
    color: '#fafafa',
  },

  // --- Content ---
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  listContainer: {
    paddingHorizontal: 16,
    marginTop: 12,
    gap: 8,
  },

  // --- Empty State ---
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
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 13,
    fontFamily: 'SpaceGroteskSemiBold',
    color: '#a1a1aa',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk',
    color: '#52525b',
    letterSpacing: 0.3,
  },

  // --- Podium ---
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
    width: 40,
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
  podiumRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  podiumLiftValue: {
    fontSize: 14,
    fontFamily: 'SpaceGroteskBold',
    color: '#fafafa',
    letterSpacing: -0.3,
  },
  locPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  locPillText: {
    fontSize: 9,
    fontFamily: 'SpaceGroteskSemiBold',
    letterSpacing: 0.5,
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
  },
  rankHighlightStar: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  rankRightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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

  // --- Sticky Current User ---
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
});
