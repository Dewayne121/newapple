import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useWorkout } from '../context/WorkoutContext';
import { useTheme } from '../context/ThemeContext';
import QuickWorkoutModal from '../components/QuickWorkoutModal';
import CustomAlert, { useCustomAlert } from '../components/CustomAlert';

export default function WorkoutHomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { templates, completedSessions, activeSession, startSession, deleteTemplate } = useWorkout();
  const { alertConfig, showAlert, hideAlert } = useCustomAlert();
  const [refreshing, setRefreshing] = useState(false);
  const [showQuickWorkoutModal, setShowQuickWorkoutModal] = useState(false);

  const sortedTemplates = useMemo(() => {
    return [...templates].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }, [templates]);

  const recentSessions = useMemo(() => {
    return [...completedSessions].sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt)).slice(0, 5);
  }, [completedSessions]);

  const handleStartWorkout = (templateId) => {
    startSession({ templateId });
    navigation.navigate('ActiveSession');
  };

  const handleQuickStart = () => {
    setShowQuickWorkoutModal(true);
  };

  const handleGenerateWorkout = async (workout, workoutName) => {
    const result = startSession({
      templateId: null,
      name: workoutName,
      initialExercises: workout,
    });
    if (result.success && result.data) {
      navigation.navigate('ActiveSession');
    }
  };

  const handleDeleteTemplate = (templateId) => {
    showAlert({
      title: 'Delete Template',
      message: 'Are you sure you want to delete this workout template?',
      icon: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteTemplate(templateId),
        },
      ],
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setRefreshing(false);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const calculateSessionStats = (session) => {
    let totalVolume = 0;
    let completedSets = 0;
    session.exercises?.forEach(exercise => {
      exercise.sets?.forEach(set => {
        if (set.completed && set.reps && set.weight) {
          totalVolume += set.reps * set.weight;
          completedSets++;
        }
      });
    });
    return { totalVolume, completedSets };
  };

  const styles = createStyles(theme, insets);

  return (
    <View style={styles.page}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>WORKOUTS</Text>
            <Text style={styles.headerSubtitle}>
              {sortedTemplates.length} TEMPLATES
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('SessionHistory')}
            style={styles.headerButton}
          >
            <Ionicons name="time-outline" size={18} color="#a1a1aa" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#DC2626" />
        }
      >
        {/* Active Session Banner */}
        {activeSession && (
          <TouchableOpacity
            style={styles.activeBanner}
            onPress={() => navigation.navigate('ActiveSession')}
            activeOpacity={0.7}
          >
            <View style={styles.activeBannerBar} />
            <View style={styles.activeBannerContent}>
              <View style={styles.activeBannerLeft}>
                <View style={styles.activeBannerIcon}>
                  <Ionicons name="play" size={14} color="#fafafa" />
                </View>
                <View style={styles.activeBannerText}>
                  <Text style={styles.activeBannerTitle}>{activeSession.name}</Text>
                  <Text style={styles.activeBannerSub}>IN PROGRESS</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#a1a1aa" />
            </View>
          </TouchableOpacity>
        )}

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
          <View style={styles.quickRow}>
            <TouchableOpacity style={styles.quickCard} onPress={handleQuickStart} activeOpacity={0.85}>
              <View style={styles.quickIcon}>
                <Ionicons name="flash" size={20} color="#DC2626" />
              </View>
              <Text style={styles.quickTitle}>Quick Workout</Text>
              <Text style={styles.quickSub}>Generate instantly</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickCard}
              onPress={() => navigation.navigate('TemplateBuilder')}
              activeOpacity={0.85}
            >
              <View style={styles.quickIcon}>
                <Ionicons name="add" size={20} color="#DC2626" />
              </View>
              <Text style={styles.quickTitle}>Create Template</Text>
              <Text style={styles.quickSub}>Build custom workout</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* My Templates */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>MY TEMPLATES</Text>
            <TouchableOpacity onPress={() => navigation.navigate('TemplateBuilder')}>
              <Text style={styles.sectionLink}>+ NEW</Text>
            </TouchableOpacity>
          </View>

          {sortedTemplates.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-outline" size={32} color="#52525b" />
              <Text style={styles.emptyTitle}>NO TEMPLATES YET</Text>
              <Text style={styles.emptySub}>Create a template to quickly start workouts</Text>
            </View>
          ) : (
            sortedTemplates.map((template) => (
              <View key={template.id} style={styles.templateCard}>
                <View style={styles.templateBar} />
                <View style={styles.templateContent}>
                  <View style={styles.templateLeft}>
                    <View style={styles.templateIcon}>
                      <Text style={styles.templateInitials}>
                        {template.name.substring(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.templateInfo}>
                      <Text style={styles.templateName} numberOfLines={1}>{template.name}</Text>
                      <Text style={styles.templateMeta}>
                        {template.exercises?.length || 0} exercises
                      </Text>
                    </View>
                  </View>
                  <View style={styles.templateActions}>
                    <TouchableOpacity
                      style={styles.templateBtn}
                      onPress={() => handleStartWorkout(template.id)}
                    >
                      <Ionicons name="play" size={16} color="#DC2626" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.templateBtn}
                      onPress={() => navigation.navigate('TemplateBuilder', { templateId: template.id })}
                    >
                      <Ionicons name="create-outline" size={16} color="#a1a1aa" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.templateBtn, styles.templateBtnDelete]}
                      onPress={() => handleDeleteTemplate(template.id)}
                    >
                      <Ionicons name="trash-outline" size={16} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Recent Sessions */}
        {recentSessions.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>RECENT SESSIONS</Text>
              <TouchableOpacity onPress={() => navigation.navigate('SessionHistory')}>
                <Text style={styles.sectionLink}>SEE ALL</Text>
              </TouchableOpacity>
            </View>

            {recentSessions.map((session) => {
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
                    <View style={styles.sessionLeft}>
                      <View style={styles.sessionIcon}>
                        <Ionicons name="checkmark-done" size={16} color="#DC2626" />
                      </View>
                      <View style={styles.sessionInfo}>
                        <Text style={styles.sessionName} numberOfLines={1}>{session.name}</Text>
                        <Text style={styles.sessionMeta}>
                          {formatDate(session.finishedAt)} • {stats.completedSets} sets
                        </Text>
                      </View>
                    </View>
                    <View style={styles.sessionRight}>
                      <Text style={styles.sessionVolume}>{stats.totalVolume.toLocaleString()} kg</Text>
                      <Text style={styles.sessionVolumeLabel}>VOLUME</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Quick Workout Modal */}
      <QuickWorkoutModal
        visible={showQuickWorkoutModal}
        onClose={() => setShowQuickWorkoutModal(false)}
        onGenerate={handleGenerateWorkout}
      />

      {/* Custom Alert */}
      <CustomAlert {...alertConfig} onClose={hideAlert} />
    </View>
  );
}

// -------------------------------------------------------------
// STYLES — Zinc Minimal, matching Dashboard aesthetic
// -------------------------------------------------------------
function createStyles(theme, insets) {
  return StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: '#09090b',
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 20,
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
    headerSubtitle: {
      fontSize: 11,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#71717a',
      letterSpacing: 1,
      marginTop: 4,
      textTransform: 'uppercase',
    },
    headerButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: '#121214',
      borderWidth: 1,
      borderColor: '#27272a',
      justifyContent: 'center',
      alignItems: 'center',
    },

    // --- Active Session Banner ---
    activeBanner: {
      backgroundColor: '#121214',
      borderWidth: 1,
      borderColor: 'rgba(220, 38, 38, 0.2)',
      borderRadius: 12,
      overflow: 'hidden',
      marginHorizontal: 16,
      marginTop: 12,
    },
    activeBannerBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: 4,
      height: '100%',
      backgroundColor: '#DC2626',
    },
    activeBannerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 14,
      paddingLeft: 18,
    },
    activeBannerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 12,
    },
    activeBannerIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: 'rgba(220, 38, 38, 0.15)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    activeBannerTitle: {
      fontSize: 14,
      fontWeight: '700',
      fontFamily: 'SpaceGroteskBold',
      color: '#fafafa',
    },
    activeBannerSub: {
      fontSize: 9,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#DC2626',
      letterSpacing: 1,
      marginTop: 2,
    },
    activeBannerText: {},

    // --- Sections ---
    section: {
      paddingHorizontal: 16,
      marginTop: 20,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    sectionLabel: {
      fontSize: 10,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#71717a',
      letterSpacing: 1.5,
      textTransform: 'uppercase',
    },
    sectionLink: {
      fontSize: 10,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#DC2626',
      letterSpacing: 1,
    },

    // --- Quick Actions ---
    quickRow: {
      flexDirection: 'row',
      gap: 10,
    },
    quickCard: {
      flex: 1,
      backgroundColor: '#121214',
      borderWidth: 1,
      borderColor: '#27272a',
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
    },
    quickIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: 'rgba(220, 38, 38, 0.08)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 10,
    },
    quickTitle: {
      fontSize: 13,
      fontWeight: '700',
      fontFamily: 'SpaceGroteskBold',
      color: '#fafafa',
      letterSpacing: 0.3,
    },
    quickSub: {
      fontSize: 10,
      fontFamily: 'SpaceGrotesk',
      color: '#71717a',
      marginTop: 3,
    },

    // --- Empty State ---
    emptyState: {
      backgroundColor: '#121214',
      borderWidth: 1,
      borderColor: '#27272a',
      borderRadius: 12,
      padding: 32,
      alignItems: 'center',
    },
    emptyTitle: {
      fontSize: 11,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#71717a',
      letterSpacing: 1.5,
      marginTop: 12,
    },
    emptySub: {
      fontSize: 11,
      fontFamily: 'SpaceGrotesk',
      color: '#52525b',
      marginTop: 4,
    },

    // --- Template Cards ---
    templateCard: {
      backgroundColor: '#121214',
      borderWidth: 1,
      borderColor: '#27272a',
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 8,
    },
    templateBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: 3,
      height: '100%',
      backgroundColor: '#27272a',
    },
    templateContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 12,
      paddingLeft: 16,
    },
    templateLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 10,
    },
    templateIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: 'rgba(220, 38, 38, 0.08)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    templateInitials: {
      fontSize: 11,
      fontWeight: '700',
      fontFamily: 'SpaceGroteskBold',
      color: '#DC2626',
    },
    templateInfo: {
      flex: 1,
      minWidth: 0,
    },
    templateName: {
      fontSize: 14,
      fontWeight: '700',
      fontFamily: 'SpaceGroteskBold',
      color: '#fafafa',
    },
    templateMeta: {
      fontSize: 10,
      fontFamily: 'SpaceGrotesk',
      color: '#71717a',
      marginTop: 2,
    },
    templateActions: {
      flexDirection: 'row',
      gap: 4,
    },
    templateBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: '#18181b',
      justifyContent: 'center',
      alignItems: 'center',
    },
    templateBtnDelete: {
      backgroundColor: 'rgba(220, 38, 38, 0.06)',
    },

    // --- Session Cards ---
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
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 12,
      paddingLeft: 16,
    },
    sessionLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 10,
      minWidth: 0,
    },
    sessionIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: 'rgba(220, 38, 38, 0.06)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    sessionInfo: {
      flex: 1,
      minWidth: 0,
    },
    sessionName: {
      fontSize: 13,
      fontWeight: '700',
      fontFamily: 'SpaceGroteskBold',
      color: '#fafafa',
    },
    sessionMeta: {
      fontSize: 10,
      fontFamily: 'SpaceGrotesk',
      color: '#71717a',
      marginTop: 2,
      letterSpacing: 0.3,
    },
    sessionRight: {
      alignItems: 'flex-end',
    },
    sessionVolume: {
      fontSize: 13,
      fontWeight: '700',
      fontFamily: 'SpaceGroteskBold',
      color: '#DC2626',
      letterSpacing: -0.3,
    },
    sessionVolumeLabel: {
      fontSize: 8,
      fontFamily: 'SpaceGroteskSemiBold',
      color: '#71717a',
      letterSpacing: 1,
      marginTop: 1,
    },
  });
}
