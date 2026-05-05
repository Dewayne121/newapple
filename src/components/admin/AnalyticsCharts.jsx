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
} from '../../constants/adminTheme';

const C = ADMIN_COLORS;
const S = ADMIN_SPACING;
const R = ADMIN_RADIUS;

// ---------------------------------------------------------------------------
// Funnel Chart
// ---------------------------------------------------------------------------
const PRESET_FUNNELS = [
  { key: 'signup_to_workout', label: 'Signup → Workout', steps: ['user_signed_up', 'workout_completed'] },
  { key: 'signup_to_challenge', label: 'Signup → Challenge', steps: ['user_signed_up', 'challenge_joined'] },
  { key: 'signup_to_purchase', label: 'Signup → Purchase', steps: ['user_signed_up', 'purchase_completed'] },
  { key: 'challenge_view_to_submit', label: 'Challenge View → Submit', steps: ['challenge_viewed', 'challenge_submitted'] },
];

export function FunnelCharts() {
  const [funnels, setFunnels] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedFunnel, setSelectedFunnel] = useState(PRESET_FUNNELS[0].key);

  const loadFunnels = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.getAnalyticsFunnels({ funnels: PRESET_FUNNELS.map(f => f.key) });
      setFunnels(response?.funnels || response || null);
    } catch {
      setFunnels(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFunnels(); }, [loadFunnels]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={s.emptyText}>Loading funnels...</Text>
      </View>
    );
  }

  if (!funnels) {
    return (
      <EmptyState message="Backend endpoint not yet available" sub="Funnels will appear once the analytics API is connected." onRetry={loadFunnels} />
    );
  }

  const current = funnels[selectedFunnel];
  const maxVal = current?.steps ? Math.max(...current.steps.map(s => s.count || 0), 1) : 1;

  return (
    <View style={s.container}>
      {/* Funnel selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.funnelSelector}>
        {PRESET_FUNNELS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[s.funnelChip, selectedFunnel === f.key && s.funnelChipActive]}
            onPress={() => setSelectedFunnel(f.key)}
          >
            <Text style={[s.funnelChipText, selectedFunnel === f.key && s.funnelChipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Chart */}
      <View style={s.chartCard}>
        {current?.steps ? current.steps.map((step, idx) => {
          const pct = maxVal > 0 ? ((step.count || 0) / maxVal) * 100 : 0;
          const conversion = idx > 0 && current.steps[idx - 1]?.count > 0
            ? ((step.count || 0) / current.steps[idx - 1].count * 100).toFixed(1)
            : null;
          return (
            <View key={idx} style={s.funnelStep}>
              <View style={s.funnelLabelRow}>
                <Text style={s.funnelStepName}>{step.name || `Step ${idx + 1}`}</Text>
                <Text style={s.funnelStepCount}>{(step.count || 0).toLocaleString()}</Text>
              </View>
              <View style={s.funnelTrack}>
                <View style={[s.funnelFill, { width: pct + '%', backgroundColor: getStepColor(idx) }]} />
              </View>
              {conversion !== null && (
                <Text style={s.funnelConversion}>{conversion}% conversion</Text>
              )}
            </View>
          );
        }) : (
          <Text style={s.emptyText}>No data for this funnel</Text>
        )}
      </View>
    </View>
  );
}

function getStepColor(idx) {
  const colors = [C.accent, C.success, C.warning, C.info];
  return colors[idx % colors.length];
}

// ---------------------------------------------------------------------------
// Retention Grid
// ---------------------------------------------------------------------------
export function RetentionGrid() {
  const [retention, setRetention] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadRetention = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.getAnalyticsRetention({ weeks: 8 });
      setRetention(response?.cohorts || response || null);
    } catch {
      setRetention(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRetention(); }, [loadRetention]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={s.emptyText}>Loading retention...</Text>
      </View>
    );
  }

  if (!retention) {
    return (
      <EmptyState message="Backend endpoint not yet available" sub="Retention cohorts will appear once the analytics API is connected." onRetry={loadRetention} />
    );
  }

  const weeks = [0, 1, 2, 3, 4, 5, 6, 7, 8];

  return (
    <ScrollView style={s.container} contentContainerStyle={s.retentionContent}>
      {/* Header row */}
      <View style={s.retentionHeader}>
        <View style={[s.retentionCell, s.retentionCohortCell]}>
          <Text style={s.retentionHeaderLabel}>COHORT</Text>
        </View>
        {weeks.map(w => (
          <View key={w} style={s.retentionCell}>
            <Text style={s.retentionHeaderLabel}>W{w}</Text>
          </View>
        ))}
      </View>

      {/* Cohort rows */}
      {Array.isArray(retention) && retention.map((cohort, rowIdx) => (
        <View key={rowIdx} style={s.retentionRow}>
          <View style={[s.retentionCell, s.retentionCohortCell]}>
            <Text style={s.retentionCohortLabel}>{cohort.cohort || `Week ${rowIdx + 1}`}</Text>
            <Text style={s.retentionCohortSize}>{cohort.size || 0} users</Text>
          </View>
          {weeks.map(w => {
            const val = cohort?.weeks?.[w] ?? (w === 0 ? 100 : 0);
            return (
              <View key={w} style={s.retentionCell}>
                <View style={[s.retentionHeatCell, { backgroundColor: getHeatColor(val) }]}>
                  <Text style={s.retentionHeatText}>{val}%</Text>
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

function getHeatColor(pct) {
  if (pct >= 80) return 'rgba(20, 184, 122, 0.35)';
  if (pct >= 60) return 'rgba(20, 184, 122, 0.22)';
  if (pct >= 40) return 'rgba(242, 169, 0, 0.18)';
  if (pct >= 20) return 'rgba(242, 169, 0, 0.12)';
  if (pct > 0) return 'rgba(220, 38, 38, 0.12)';
  return C.surface;
}

// ---------------------------------------------------------------------------
// Error Chart
// ---------------------------------------------------------------------------
export function ErrorTable() {
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedIdx, setExpandedIdx] = useState(null);

  const loadErrors = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.getAnalyticsEvents({ category: 'ERRORS', limit: 50 });
      setErrors(response?.events || (Array.isArray(response) ? response : []));
    } catch {
      setErrors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadErrors(); }, [loadErrors]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={s.emptyText}>Loading errors...</Text>
      </View>
    );
  }

  if (errors.length === 0) {
    return (
      <EmptyState message="No errors recorded" sub="Error events will appear here when they occur." onRetry={loadErrors} />
    );
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.errorContent}>
      {errors.map((err, idx) => {
        const isExpanded = expandedIdx === idx;
        return (
          <TouchableOpacity
            key={err.event_id || idx}
            style={s.errorCard}
            onPress={() => setExpandedIdx(isExpanded ? null : idx)}
            activeOpacity={0.7}
          >
            <View style={s.errorTop}>
              <View style={s.errorDot} />
              <Text style={s.errorName} numberOfLines={1}>{err.name || 'error_seen'}</Text>
              <Text style={s.errorTime}>{err.timestamp ? new Date(err.timestamp).toLocaleDateString() : '--'}</Text>
            </View>
            <Text style={s.errorMessage} numberOfLines={isExpanded ? undefined : 2}>
              {err.properties?.message || err.properties?.error || JSON.stringify(err.properties || {})}
            </Text>
            {isExpanded && (
              <View style={s.errorDetail}>
                {err.properties?.screen && <Text style={s.errorMeta}>Screen: {err.properties.screen}</Text>}
                {err.properties?.platform && <Text style={s.errorMeta}>Platform: {err.properties.platform}</Text>}
                {err.properties?.stack && (
                  <ScrollView style={s.stackScroll}>
                    <Text style={s.stackText}>{err.properties.stack}</Text>
                  </ScrollView>
                )}
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Empty state helper
// ---------------------------------------------------------------------------
function EmptyState({ message, sub, onRetry }) {
  return (
    <View style={s.center}>
      <Ionicons name="analytics-outline" size={36} color={C.textSubtle} />
      <Text style={s.emptyTitle}>{message}</Text>
      <Text style={s.emptyText}>{sub}</Text>
      {onRetry && (
        <TouchableOpacity style={s.retryBtn} onPress={onRetry}>
          <Text style={s.retryText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Shared Styles
// ---------------------------------------------------------------------------
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
    textAlign: 'center',
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

  // Funnel
  funnelSelector: {
    maxHeight: 44,
    paddingHorizontal: S.lg,
    marginBottom: S.md,
  },
  funnelChip: {
    paddingHorizontal: S.md,
    paddingVertical: S.xs + 2,
    borderRadius: R.xs,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    marginRight: S.xs,
  },
  funnelChipActive: {
    backgroundColor: C.accent + '18',
    borderColor: C.accent + '60',
  },
  funnelChipText: {
    fontSize: 10,
    fontFamily: 'SpaceGroteskSemiBold',
    color: C.textSubtle,
    letterSpacing: 0.5,
  },
  funnelChipTextActive: {
    color: C.accent,
  },
  chartCard: {
    marginHorizontal: S.lg,
    backgroundColor: C.card,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    padding: S.md,
  },
  funnelStep: {
    marginBottom: S.md,
  },
  funnelLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  funnelStepName: {
    fontSize: 11,
    fontFamily: 'SpaceGroteskSemiBold',
    color: C.text,
    flex: 1,
  },
  funnelStepCount: {
    fontSize: 11,
    fontFamily: 'SpaceGroteskBold',
    color: C.text,
  },
  funnelTrack: {
    height: 10,
    backgroundColor: C.surface,
    borderRadius: 5,
    overflow: 'hidden',
  },
  funnelFill: {
    height: '100%',
    borderRadius: 5,
  },
  funnelConversion: {
    fontSize: 9,
    fontFamily: 'SpaceGrotesk',
    color: C.textSubtle,
    marginTop: 3,
    textAlign: 'right',
  },

  // Retention
  retentionContent: {
    paddingBottom: S.xxl,
    paddingHorizontal: S.lg,
  },
  retentionHeader: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  retentionRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  retentionCell: {
    width: 36,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 2,
  },
  retentionCohortCell: {
    width: 80,
    alignItems: 'flex-start',
    paddingLeft: S.xs,
  },
  retentionHeaderLabel: {
    fontSize: 8,
    fontFamily: 'SpaceGroteskBold',
    color: C.textSubtle,
    letterSpacing: 0.8,
  },
  retentionCohortLabel: {
    fontSize: 9,
    fontFamily: 'SpaceGroteskBold',
    color: C.text,
  },
  retentionCohortSize: {
    fontSize: 7,
    fontFamily: 'SpaceGrotesk',
    color: C.textSubtle,
  },
  retentionHeatCell: {
    width: 32,
    height: 32,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retentionHeatText: {
    fontSize: 8,
    fontFamily: 'SpaceGroteskBold',
    color: C.text,
  },

  // Errors
  errorContent: {
    paddingBottom: S.xxl,
    paddingHorizontal: S.lg,
  },
  errorCard: {
    backgroundColor: C.card,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    padding: S.md,
    marginBottom: S.xs,
  },
  errorTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.xs,
    marginBottom: 6,
  },
  errorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.danger,
  },
  errorName: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'SpaceGroteskSemiBold',
    color: C.text,
  },
  errorTime: {
    fontSize: 10,
    fontFamily: 'SpaceGrotesk',
    color: C.textSubtle,
  },
  errorMessage: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk',
    color: C.textSubtle,
    lineHeight: 16,
  },
  errorDetail: {
    marginTop: S.sm,
    paddingTop: S.sm,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  errorMeta: {
    fontSize: 10,
    fontFamily: 'SpaceGrotesk',
    color: C.textSubtle,
    marginBottom: 3,
  },
  stackScroll: {
    maxHeight: 120,
    backgroundColor: C.surface,
    borderRadius: R.xs,
    padding: S.sm,
    marginTop: S.xs,
  },
  stackText: {
    fontSize: 9,
    fontFamily: 'SpaceGrotesk',
    color: C.textSubtle,
    lineHeight: 14,
  },
});
