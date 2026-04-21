import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useWorkout } from '../context/WorkoutContext';
import { useTheme } from '../context/ThemeContext';

export default function SessionHistoryScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { sessions, deleteSession } = useWorkout();
  const styles = createStyles(insets);

  const groupedSessions = useMemo(() => {
    const groups = {};
    const completedSessions = sessions.filter(s => s.status === 'complete');

    completedSessions.forEach(session => {
      const date = new Date(session.finishedAt);
      const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      if (!groups[dateKey]) {
        groups[dateKey] = {
          date,
          sessions: [],
        };
      }
      groups[dateKey].sessions.push(session);
    });

    return Object.entries(groups)
      .map(([key, value]) => ({ date: value.date, sessions: value.sessions }))
      .sort((a, b) => b.date - a.date);
  }, [sessions]);

  const calculateSessionStats = (session) => {
    let totalVolume = 0;
    let completedSets = 0;
    let totalExercises = session.exercises?.length || 0;

    session.exercises?.forEach(exercise => {
      exercise.sets?.forEach(set => {
        if (set.completed && set.reps && set.weight) {
          totalVolume += set.reps * set.weight;
          completedSets++;
        }
      });
    });

    return { totalVolume, completedSets, totalExercises };
  };

  const formatDate = (date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'TODAY';
    if (date.toDateString() === yesterday.toDateString()) return 'YESTERDAY';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
  };

  const formatDuration = (startedAt, finishedAt) => {
    const start = new Date(startedAt);
    const end = new Date(finishedAt);
    const minutes = Math.floor((end - start) / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hrs}h ${mins}m`;
  };

  const handleDeleteSession = (sessionId) => {
    deleteSession(sessionId);
  };

  return (
    <View style={styles.page}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
            <Ionicons name="arrow-back" size={20} color="#fafafa" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>HISTORY</Text>
            <Text style={styles.headerSub}>{sessions.filter(s => s.status === 'complete').length} SESSIONS</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {groupedSessions.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="time-outline" size={32} color="#52525b" />
            </View>
            <Text style={styles.emptyTitle}>NO SESSIONS YET</Text>
            <Text style={styles.emptySub}>Complete a workout to see it here</Text>
          </View>
        ) : (
          groupedSessions.map(({ date, sessions: daySessions }) => (
            <View key={date.toDateString()} style={styles.dayGroup}>
              <Text style={styles.dayLabel}>{formatDate(date)}</Text>

              {daySessions.map((session) => {
                const stats = calculateSessionStats(session);
                return (
                  <TouchableOpacity
                    key={session.id}
                    style={styles.sessionCard}
                    onPress={() => navigation.navigate('SessionDetail', { sessionId: session.id })}
                    activeOpacity={0.7}
                  >
                    <View style={styles.sessionBar} />
                    <View style={styles.sessionContent}>
                      <View style={styles.sessionTop}>
                        <Text style={styles.sessionName} numberOfLines={1}>{session.name}</Text>
                        <Text style={styles.sessionDuration}>
                          {formatDuration(session.startedAt, session.finishedAt)}
                        </Text>
                      </View>
                      <View style={styles.sessionMetaRow}>
                        <View style={styles.metaItem}>
                          <Ionicons name="barbell-outline" size={12} color="#71717a" />
                          <Text style={styles.metaText}>{stats.totalExercises} exercises</Text>
                        </View>
                        <View style={styles.metaItem}>
                          <Ionicons name="layers-outline" size={12} color="#71717a" />
                          <Text style={styles.metaText}>{stats.completedSets} sets</Text>
                        </View>
                        <View style={styles.metaItem}>
                          <Ionicons name="trending-up-outline" size={12} color="#71717a" />
                          <Text style={styles.metaText}>{stats.totalVolume.toLocaleString()} kg</Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

function createStyles(insets) {
  return StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: '#09090b',
    },
    header: {
      paddingHorizontal: 16,
      paddingBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: '#27272a',
      backgroundColor: '#09090b',
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerBack: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: '#121214',
      borderWidth: 1,
      borderColor: '#27272a',
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 16,
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
    },
    headerSpacer: {
      width: 40,
    },

    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
    },

    // --- Empty State ---
    emptyState: {
      alignItems: 'center',
      paddingVertical: 60,
    },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 16,
      backgroundColor: '#121214',
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
      letterSpacing: 1.5,
    },
    emptySub: {
      fontSize: 11,
      fontFamily: 'SpaceGrotesk',
      color: '#52525b',
      marginTop: 6,
    },

    // --- Day Groups ---
    dayGroup: {
      marginBottom: 20,
    },
    dayLabel: {
      fontSize: 10,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#71717a',
      letterSpacing: 1.5,
      marginBottom: 10,
    },

    // --- Session Card ---
    sessionCard: {
      backgroundColor: '#121214',
      borderWidth: 1,
      borderColor: '#27272a',
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 8,
    },
    sessionBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: 3,
      height: '100%',
      backgroundColor: '#DC2626',
    },
    sessionContent: {
      padding: 14,
      paddingLeft: 18,
    },
    sessionTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    sessionName: {
      fontSize: 14,
      fontWeight: '700',
      fontFamily: 'SpaceGroteskBold',
      color: '#fafafa',
      flex: 1,
      paddingRight: 8,
    },
    sessionDuration: {
      fontSize: 11,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#71717a',
    },
    sessionMetaRow: {
      flexDirection: 'row',
      gap: 14,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    metaText: {
      fontSize: 10,
      fontFamily: 'SpaceGrotesk',
      color: '#a1a1aa',
      letterSpacing: 0.3,
    },
  });
}
