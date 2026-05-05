import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import {
  ADMIN_COLORS,
  ADMIN_SPACING,
  ADMIN_RADIUS,
  ADMIN_SHADOWS,
} from '../../constants/adminTheme';
import { EVENT_CATEGORIES } from '../../constants/analyticsEvents';

const C = ADMIN_COLORS;
const S = ADMIN_SPACING;
const R = ADMIN_RADIUS;

const CATEGORY_COLORS = {
  AUTH: '#4C8DFF',
  NAVIGATION: '#71717a',
  WORKOUTS: '#14B87A',
  CHALLENGES: '#F2A900',
  LEADERBOARDS: '#8B5CF6',
  SOCIAL: '#EC4899',
  MONETIZATION: '#DC2626',
  NOTIFICATIONS: '#06B6D4',
  ERRORS: '#FF3B30',
  ONBOARDING: '#10B981',
  SYSTEM: '#6B7280',
};

const FILTER_OPTIONS = ['All', ...Object.keys(EVENT_CATEGORIES || {})];

export default function AnalyticsEventStream() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('All');
  const [expandedId, setExpandedId] = useState(null);

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.getAnalyticsEvents({ limit: 100 });
      if (response?.events) {
        setEvents(response.events);
      } else if (Array.isArray(response)) {
        setEvents(response);
      }
    } catch (err) {
      setError('Backend endpoint not yet available');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
    const interval = setInterval(loadEvents, 10000);
    return () => clearInterval(interval);
  }, [loadEvents]);

  const filtered = filter === 'All'
    ? events
    : events.filter(e => e.category === filter || e.name?.includes(filter.toLowerCase()));

  const getCategoryColor = (category) => CATEGORY_COLORS[category] || C.textSubtle;

  const formatTime = (ts) => {
    if (!ts) return '--';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getPlatformIcon = (platform) => {
    if (platform === 'ios') return 'phone-portrait';
    if (platform === 'android') return 'phone-portrait-outline';
    return 'globe-outline';
  };

  if (loading && events.length === 0) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={s.emptyText}>Loading event stream...</Text>
      </View>
    );
  }

  if (error && events.length === 0) {
    return (
      <View style={s.center}>
        <Ionicons name="server-outline" size={36} color={C.textSubtle} />
        <Text style={s.emptyTitle}>{error}</Text>
        <Text style={s.emptyText}>Analytics events will appear here once the backend endpoint is connected.</Text>
        <TouchableOpacity style={s.retryBtn} onPress={loadEvents}>
          <Text style={s.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow}>
        {FILTER_OPTIONS.map(f => (
          <TouchableOpacity
            key={f}
            style={[s.filterChip, filter === f && s.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            {f !== 'All' && <View style={[s.filterDot, { backgroundColor: getCategoryColor(f) }]} />}
            <Text style={[s.filterText, filter === f && s.filterTextActive]}>
              {f === 'All' ? 'ALL' : f}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Event Count */}
      <View style={s.countRow}>
        <Text style={s.countText}>{filtered.length} events</Text>
        <TouchableOpacity onPress={loadEvents} style={s.refreshSmall}>
          <Ionicons name="refresh" size={14} color={C.textSubtle} />
        </TouchableOpacity>
      </View>

      {/* Events List */}
      {filtered.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyText}>No events match this filter</Text>
        </View>
      ) : (
        <ScrollView style={s.list} contentContainerStyle={s.listContent}>
          {filtered.map((event, idx) => {
            const isExpanded = expandedId === `${idx}`;
            const catColor = getCategoryColor(event.category);
            return (
              <TouchableOpacity
                key={event.event_id || idx}
                style={s.eventCard}
                onPress={() => setExpandedId(isExpanded ? null : `${idx}`)}
                activeOpacity={0.7}
              >
                <View style={s.eventTop}>
                  <View style={[s.categoryBadge, { backgroundColor: catColor + '18', borderColor: catColor + '40' }]}>
                    <Text style={[s.categoryText, { color: catColor }]}>{event.category || 'SYS'}</Text>
                  </View>
                  <Text style={s.eventName} numberOfLines={1}>{event.name || 'unknown_event'}</Text>
                  <Ionicons name={getPlatformIcon(event.platform)} size={12} color={C.textSubtle} style={s.platformIcon} />
                  <Text style={s.eventTime}>{formatTime(event.timestamp)}</Text>
                </View>

                {event.user_id && (
                  <Text style={s.eventMeta}>user: {event.user_id.slice(0, 8)}...</Text>
                )}

                {isExpanded && (
                  <View style={s.expandedContent}>
                    <View style={s.divider} />
                    {Object.entries(event).map(([key, val]) => (
                      <View key={key} style={s.jsonRow}>
                        <Text style={s.jsonKey}>{key}</Text>
                        <Text style={s.jsonVal} numberOfLines={3}>
                          {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: S.xl,
    paddingVertical: S.xxl,
  },
  emptyTitle: {
    fontSize: 14,
    fontFamily: 'SpaceGroteskBold',
    color: C.textSubtle,
    marginTop: S.md,
    marginBottom: S.xs,
  },
  emptyText: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk',
    color: C.textSubtle,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryBtn: {
    marginTop: S.md,
    paddingHorizontal: S.lg,
    paddingVertical: S.sm,
    backgroundColor: C.accent,
    borderRadius: R.sm,
  },
  retryText: {
    fontSize: 12,
    fontFamily: 'SpaceGroteskBold',
    color: '#fff',
  },

  filterRow: {
    maxHeight: 44,
    paddingHorizontal: S.lg,
    marginBottom: S.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: S.md,
    paddingVertical: S.xs + 2,
    borderRadius: R.xs,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    marginRight: S.xs,
    gap: 5,
  },
  filterChipActive: {
    backgroundColor: C.accent + '18',
    borderColor: C.accent + '60',
  },
  filterText: {
    fontSize: 10,
    fontFamily: 'SpaceGroteskSemiBold',
    color: C.textSubtle,
    letterSpacing: 0.8,
  },
  filterTextActive: {
    color: C.accent,
  },
  filterDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  countRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: S.lg,
    marginBottom: S.sm,
  },
  countText: {
    fontSize: 10,
    fontFamily: 'SpaceGroteskSemiBold',
    color: C.textSubtle,
    letterSpacing: 0.8,
  },
  refreshSmall: {
    padding: S.xs,
  },

  list: { flex: 1 },
  listContent: { paddingBottom: S.xxl, paddingHorizontal: S.lg },

  eventCard: {
    backgroundColor: C.card,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    padding: S.md,
    marginBottom: S.xs,
  },
  eventTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.sm,
  },
  categoryBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: 8,
    fontFamily: 'SpaceGroteskBold',
    letterSpacing: 0.8,
  },
  eventName: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'SpaceGroteskSemiBold',
    color: C.text,
  },
  platformIcon: {
    marginLeft: 'auto',
  },
  eventTime: {
    fontSize: 10,
    fontFamily: 'SpaceGrotesk',
    color: C.textSubtle,
    marginLeft: S.xs,
  },
  eventMeta: {
    fontSize: 10,
    fontFamily: 'SpaceGrotesk',
    color: C.textSubtle,
    marginTop: 4,
    marginLeft: 2,
  },

  expandedContent: {
    marginTop: S.sm,
  },
  divider: {
    height: 1,
    backgroundColor: C.border,
    marginBottom: S.sm,
  },
  jsonRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  jsonKey: {
    width: 100,
    fontSize: 10,
    fontFamily: 'SpaceGroteskBold',
    color: C.textSubtle,
  },
  jsonVal: {
    flex: 1,
    fontSize: 10,
    fontFamily: 'SpaceGrotesk',
    color: C.text,
  },
});
