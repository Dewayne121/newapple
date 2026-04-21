import React, { useMemo, useState } from 'react';
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
import { useApp, EXERCISES } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import CustomAlert, { useCustomAlert } from '../components/CustomAlert';

export default function SessionDetailScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { sessions, deleteSession } = useWorkout();
  const { weightUnit } = useApp();
  const { alertConfig, showAlert, hideAlert } = useCustomAlert();
  const styles = createStyles(insets);

  const sessionId = route.params?.sessionId;
  const session = sessions.find(s => s.id === sessionId);
  const [expandedExerciseId, setExpandedExerciseId] = useState(null);

  if (!session) {
    return (
      <View style={[styles.page, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
              <Ionicons name="arrow-back" size={20} color="#fafafa" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>NOT FOUND</Text>
            <View style={styles.headerSpacer} />
          </View>
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={32} color="#52525b" />
          <Text style={styles.emptyTitle}>SESSION NOT FOUND</Text>
        </View>
      </View>
    );
  }

  const calculateSessionStats = useMemo(() => {
    let totalVolume = 0;
    let completedSets = 0;
    let totalSets = 0;

    session.exercises?.forEach(exercise => {
      exercise.sets?.forEach(set => {
        totalSets++;
        if (set.completed && set.reps && set.weight) {
          totalVolume += set.reps * set.weight;
          completedSets++;
        }
      });
    });

    return { totalVolume, completedSets, totalSets };
  }, [session]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatDuration = (startedAt, finishedAt) => {
    const start = new Date(startedAt);
    const end = new Date(finishedAt);
    const minutes = Math.floor((end - start) / 60000);
    if (minutes < 60) return `${minutes} minutes`;
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hrs}h ${mins}m`;
  };

  const handleDelete = () => {
    showAlert({
      title: 'Delete Session',
      message: 'Are you sure you want to delete this workout session? This cannot be undone.',
      icon: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteSession(sessionId);
            navigation.goBack();
          },
        },
      ],
    });
  };

  const getExercise = (exerciseId) => {
    return EXERCISES.find(e => e.id === exerciseId);
  };

  return (
    <View style={styles.page}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
            <Ionicons name="arrow-back" size={20} color="#fafafa" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>SESSION DETAILS</Text>
          <TouchableOpacity onPress={handleDelete} style={styles.headerDelete}>
            <Ionicons name="trash-outline" size={18} color="#DC2626" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Session Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoBar} />
          <View style={styles.infoContent}>
            <Text style={styles.sessionName}>{session.name}</Text>
            <Text style={styles.sessionDate}>{formatDate(session.finishedAt)}</Text>
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={12} color="#71717a" />
                <Text style={styles.metaText}>
                  {formatTime(session.startedAt)} – {formatTime(session.finishedAt)}
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="hourglass-outline" size={12} color="#71717a" />
                <Text style={styles.metaText}>
                  {formatDuration(session.startedAt, session.finishedAt)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{session.exercises?.length || 0}</Text>
            <Text style={styles.statLabel}>EXERCISES</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{calculateSessionStats.completedSets}</Text>
            <Text style={styles.statLabel}>SETS</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{calculateSessionStats.totalVolume.toLocaleString()}</Text>
            <Text style={styles.statLabel}>VOLUME KG</Text>
          </View>
        </View>

        {/* Notes */}
        {session.notes && (
          <View style={styles.notesCard}>
            <Text style={styles.notesLabel}>NOTES</Text>
            <Text style={styles.notesText}>{session.notes}</Text>
          </View>
        )}

        {/* Exercises */}
        <View style={styles.exercisesSection}>
          <Text style={styles.sectionLabel}>EXERCISES</Text>

          {session.exercises?.map((exercise, index) => {
            const exerciseData = getExercise(exercise.exerciseId);
            const isExpanded = expandedExerciseId === exercise.id;

            let exerciseVolume = 0;
            let exerciseCompletedSets = 0;
            exercise.sets?.forEach(set => {
              if (set.completed && set.reps && set.weight) {
                exerciseVolume += set.reps * set.weight;
                exerciseCompletedSets++;
              }
            });

            return (
              <View key={exercise.id} style={styles.exerciseCard}>
                <TouchableOpacity
                  style={styles.exerciseHeader}
                  onPress={() => setExpandedExerciseId(isExpanded ? null : exercise.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.exerciseHeaderLeft}>
                    <View style={styles.exerciseNumberBadge}>
                      <Text style={styles.exerciseNumber}>{index + 1}</Text>
                    </View>
                    <View style={styles.exerciseNameWrap}>
                      <Text style={styles.exerciseName}>
                        {exerciseData?.name || exercise.exerciseId}
                      </Text>
                      <Text style={styles.exerciseMeta}>
                        {exerciseCompletedSets}/{exercise.sets?.length || 0} sets
                        {exerciseVolume > 0 && ` \u2022 ${exerciseVolume} kg`}
                      </Text>
                    </View>
                  </View>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color="#71717a"
                  />
                </TouchableOpacity>

                {isExpanded && exercise.sets && exercise.sets.length > 0 && (
                  <View style={styles.setsContainer}>
                    {exercise.sets.map((set) => (
                      <View key={set.id} style={styles.setRow}>
                        <Text style={styles.setNumber}>{set.setNumber}</Text>
                        <View style={styles.setValues}>
                          {set.reps && set.weight ? (
                            <Text style={styles.setDetail}>
                              {set.reps} reps \u00d7 {set.weight} {weightUnit}
                            </Text>
                          ) : set.durationSeconds ? (
                            <Text style={styles.setDetail}>{set.durationSeconds}s</Text>
                          ) : set.distance ? (
                            <Text style={styles.setDetail}>{set.distance}</Text>
                          ) : (
                            <Text style={styles.setDetailEmpty}>No data</Text>
                          )}
                        </View>
                        <View style={[
                          styles.setStatus,
                          set.completed ? styles.setStatusDone : styles.setStatusIncomplete,
                        ]}>
                          <Ionicons
                            name={set.completed ? 'checkmark' : 'close'}
                            size={12}
                            color="#fafafa"
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <CustomAlert {...alertConfig} onClose={hideAlert} />
    </View>
  );
}

function createStyles(insets) {
  return StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: '#09090b',
    },

    // --- Header ---
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
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: 13,
      fontWeight: '900',
      fontFamily: 'SpaceGroteskBold',
      color: '#fafafa',
      letterSpacing: 1.5,
    },
    headerDelete: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: 'rgba(220, 38, 38, 0.08)',
      justifyContent: 'center',
      alignItems: 'center',
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

    // --- Empty ---
    emptyState: {
      alignItems: 'center',
      paddingVertical: 60,
    },
    emptyTitle: {
      fontSize: 12,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#71717a',
      letterSpacing: 1.5,
      marginTop: 12,
    },

    // --- Info Card ---
    infoCard: {
      backgroundColor: '#121214',
      borderWidth: 1,
      borderColor: '#27272a',
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 12,
    },
    infoBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: 4,
      height: '100%',
      backgroundColor: '#DC2626',
    },
    infoContent: {
      padding: 16,
      paddingLeft: 20,
    },
    sessionName: {
      fontSize: 20,
      fontWeight: '700',
      fontFamily: 'SpaceGroteskBold',
      color: '#fafafa',
      marginBottom: 4,
    },
    sessionDate: {
      fontSize: 12,
      fontFamily: 'SpaceGrotesk',
      color: '#71717a',
      marginBottom: 12,
    },
    metaRow: {
      flexDirection: 'row',
      gap: 16,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    metaText: {
      fontSize: 11,
      fontFamily: 'SpaceGrotesk',
      color: '#a1a1aa',
    },

    // --- Stats Row ---
    statsRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    statCard: {
      flex: 1,
      backgroundColor: '#121214',
      borderWidth: 1,
      borderColor: '#27272a',
      borderRadius: 12,
      padding: 14,
      alignItems: 'center',
    },
    statValue: {
      fontSize: 20,
      fontWeight: '700',
      fontFamily: 'SpaceGroteskBold',
      color: '#DC2626',
    },
    statLabel: {
      fontSize: 9,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#71717a',
      letterSpacing: 1,
      marginTop: 4,
    },

    // --- Notes ---
    notesCard: {
      backgroundColor: '#121214',
      borderWidth: 1,
      borderColor: '#27272a',
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    notesLabel: {
      fontSize: 9,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#71717a',
      letterSpacing: 1.5,
      marginBottom: 8,
    },
    notesText: {
      fontSize: 13,
      fontFamily: 'SpaceGrotesk',
      color: '#d4d4d8',
      lineHeight: 20,
    },

    // --- Exercises ---
    exercisesSection: {
      marginBottom: 16,
    },
    sectionLabel: {
      fontSize: 10,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#71717a',
      letterSpacing: 1.5,
      marginBottom: 12,
    },
    exerciseCard: {
      backgroundColor: '#121214',
      borderWidth: 1,
      borderColor: '#27272a',
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 8,
    },
    exerciseHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 14,
    },
    exerciseHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 12,
    },
    exerciseNumberBadge: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: 'rgba(220, 38, 38, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    exerciseNumber: {
      fontSize: 12,
      fontWeight: '700',
      fontFamily: 'SpaceGroteskBold',
      color: '#DC2626',
    },
    exerciseNameWrap: {
      flex: 1,
      minWidth: 0,
    },
    exerciseName: {
      fontSize: 14,
      fontWeight: '600',
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#fafafa',
    },
    exerciseMeta: {
      fontSize: 11,
      fontFamily: 'SpaceGrotesk',
      color: '#71717a',
      marginTop: 2,
    },

    // --- Sets ---
    setsContainer: {
      paddingHorizontal: 14,
      paddingBottom: 14,
      borderTopWidth: 1,
      borderTopColor: '#27272a',
    },
    setRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
    },
    setNumber: {
      width: 24,
      fontSize: 11,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#71717a',
    },
    setValues: {
      flex: 1,
    },
    setDetail: {
      fontSize: 13,
      fontFamily: 'SpaceGrotesk',
      color: '#d4d4d8',
    },
    setDetailEmpty: {
      fontSize: 13,
      fontFamily: 'SpaceGrotesk',
      color: '#52525b',
    },
    setStatus: {
      width: 22,
      height: 22,
      borderRadius: 6,
      justifyContent: 'center',
      alignItems: 'center',
    },
    setStatusDone: {
      backgroundColor: '#22c55e',
    },
    setStatusIncomplete: {
      backgroundColor: '#3f3f46',
    },
  });
}
