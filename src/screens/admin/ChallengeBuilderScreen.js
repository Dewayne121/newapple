import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import CustomAlert, { useCustomAlert } from '../../components/CustomAlert';
import api from '../../services/api';
import { COMPETITIVE_LIFTS } from '../../constants/competitiveLifts';
import {
  ADMIN_COLORS,
  ADMIN_SPACING,
  ADMIN_RADIUS,
  ADMIN_SHADOWS,
  ADMIN_SURFACES,
} from '../../constants/adminTheme';

const C = ADMIN_COLORS;
const S = ADMIN_SPACING;
const R = ADMIN_RADIUS;

// Exercise metadata — determines what fields to show
const WEIGHTED_LIFTS = new Set([
  'bench_press', 'deadlift', 'squat', 'barbell_row', 'overhead_press',
  'hip_thrust', 'lat_pulldown', 'goblet_squat', 'romanian_deadlift',
]);
const TIMED_LIFTS = new Set(['plank']);
const BODYWEIGHT_LIFTS = new Set([
  'pullups', 'pushups', 'bodyweight_squat', 'incline_pushup', 'step_ups',
]);

const CATEGORIES = [
  { key: 'weighted', label: 'Weighted', icon: 'barbell' },
  { key: 'bodyweight', label: 'Bodyweight', icon: 'body' },
  { key: 'timed', label: 'Timed', icon: 'timer-outline' },
];

function getExerciseMeta(id) {
  if (WEIGHTED_LIFTS.has(id)) return { type: 'weighted', metricType: 'weight', unit: 'kg', targetLabel: 'Weight' };
  if (TIMED_LIFTS.has(id)) return { type: 'timed', metricType: 'duration', unit: 'sec', targetLabel: 'Duration' };
  return { type: 'bodyweight', metricType: 'reps', unit: 'reps', targetLabel: 'Reps' };
}

export default function ChallengeBuilderScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { alertConfig, showAlert, hideAlert } = useCustomAlert();
  const { challenge, isEdit } = route.params || {};
  const [saving, setSaving] = useState(false);
  const getChallengeId = (item) => item?.id || item?._id || null;

  const [title, setTitle] = useState(challenge?.title || '');
  const [description, setDescription] = useState(challenge?.description || '');
  const [selectedLift, setSelectedLift] = useState(challenge?.exercises?.[0] || 'bench_press');
  const [target, setTarget] = useState(challenge?.target?.toString() || '');
  const [startDate, setStartDate] = useState(
    challenge?.startDate ? new Date(challenge.startDate) : new Date()
  );
  const [endDate, setEndDate] = useState(
    challenge?.endDate ? new Date(challenge.endDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  );
  const [reward, setReward] = useState(challenge?.reward?.toString() || '100');
  const [rules, setRules] = useState(challenge?.rules || '');
  const [requiresVideo, setRequiresVideo] = useState(challenge?.requiresVideo !== false);
  const [gender, setGender] = useState(challenge?.gender || null);

  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  const meta = useMemo(() => getExerciseMeta(selectedLift), [selectedLift]);
  const activeCategory = meta.type;

  const filteredLifts = useMemo(() => {
    if (activeCategory === 'weighted') return COMPETITIVE_LIFTS.filter(l => WEIGHTED_LIFTS.has(l.id));
    if (activeCategory === 'timed') return COMPETITIVE_LIFTS.filter(l => TIMED_LIFTS.has(l.id));
    return COMPETITIVE_LIFTS.filter(l => BODYWEIGHT_LIFTS.has(l.id));
  }, [activeCategory]);

  const handleCategoryChange = (cat) => {
    const first = COMPETITIVE_LIFTS.find(l =>
      cat === 'weighted' ? WEIGHTED_LIFTS.has(l.id) : cat === 'timed' ? TIMED_LIFTS.has(l.id) : BODYWEIGHT_LIFTS.has(l.id)
    );
    if (first) setSelectedLift(first.id);
    setTarget('');
  };

  const handleSave = async () => {
    if (!title.trim()) return showAlert({ title: 'Required', message: 'Enter a challenge title', icon: 'warning', buttons: [{ text: 'OK', style: 'default' }] });
    if (!target || parseFloat(target) <= 0) return showAlert({ title: 'Required', message: `Enter a valid target (${meta.unit})`, icon: 'warning', buttons: [{ text: 'OK', style: 'default' }] });
    if (endDate <= startDate) return showAlert({ title: 'Invalid', message: 'End date must be after start date', icon: 'warning', buttons: [{ text: 'OK', style: 'default' }] });

    try {
      setSaving(true);
      const challengeData = {
        title: title.trim(),
        description: description.trim(),
        challengeType: 'exercise',
        exercises: [selectedLift],
        metricType: meta.metricType,
        target: parseFloat(target),
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        regionScope: 'global',
        reward: parseInt(reward) || 100,
        rules: rules.trim(),
        completionType: meta.type === 'timed' ? 'best_effort' : 'best_effort',
        winnerCriteria: 'best_single',
        requiresVideo,
        maxParticipants: 0,
        gender: gender || null,
      };

      let response;
      if (isEdit && challenge) {
        const challengeId = getChallengeId(challenge);
        if (!challengeId) throw new Error('Challenge ID is missing.');
        response = await api.updateChallenge(challengeId, challengeData);
      } else {
        response = await api.createChallenge(challengeData);
      }

      if (response.success) {
        showAlert({
          title: 'Success',
          message: isEdit ? 'Challenge updated' : 'Challenge created',
          icon: 'success',
          buttons: [{ text: 'OK', onPress: () => navigation.goBack() }],
        });
      }
    } catch (err) {
      showAlert({ title: 'Error', message: err.message || 'Failed to save', icon: 'error', buttons: [{ text: 'OK', style: 'default' }] });
    } finally {
      setSaving(false);
    }
  };

  const daysLeft = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
  const selectedLiftData = COMPETITIVE_LIFTS.find(l => l.id === selectedLift);

  return (
    <View style={[styles.container, { paddingTop: insets.top + S.lg }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={C.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? 'Edit Challenge' : 'New Challenge'}</Text>
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator size="small" color={C.white} /> : (
            <><Ionicons name="checkmark" size={16} color={C.white} /><Text style={styles.saveBtnText}>Save</Text></>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Exercise Type Tabs */}
        <View style={styles.catRow}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.key}
              style={[styles.catBtn, activeCategory === cat.key && styles.catBtnActive]}
              onPress={() => handleCategoryChange(cat.key)}
              activeOpacity={0.7}
            >
              <Ionicons name={cat.icon} size={14} color={activeCategory === cat.key ? C.accent : C.textSubtle} />
              <Text style={[styles.catText, activeCategory === cat.key && styles.catTextActive]}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Exercise Grid */}
        <View style={styles.exerciseGrid}>
          {filteredLifts.map(lift => (
            <TouchableOpacity
              key={lift.id}
              style={[styles.exerciseBtn, selectedLift === lift.id && styles.exerciseBtnActive]}
              onPress={() => { setSelectedLift(lift.id); setTarget(''); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.exerciseLabel, selectedLift === lift.id && styles.exerciseLabelActive]}>
                {lift.label}
              </Text>
              {selectedLift === lift.id && <Ionicons name="checkmark" size={12} color={C.accent} style={{ marginLeft: 4 }} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Title */}
        <TextInput
          style={styles.titleInput}
          placeholder="Challenge title"
          placeholderTextColor={C.textSubtle}
          value={title}
          onChangeText={setTitle}
        />

        {/* Target + Unit */}
        <View style={styles.targetRow}>
          <View style={styles.targetField}>
            <TextInput
              style={styles.targetInput}
              placeholder="0"
              placeholderTextColor={C.textSubtle}
              value={target}
              onChangeText={setTarget}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.targetUnitBadge}>
            <Text style={styles.targetUnitText}>{meta.unit.toUpperCase()}</Text>
          </View>
          <View style={styles.targetDesc}>
            <Text style={styles.targetDescText}>
              {meta.type === 'weighted'
                ? `Min ${selectedLiftData?.label} weight`
                : meta.type === 'timed'
                ? `Min ${selectedLiftData?.label} hold`
                : `Min ${selectedLiftData?.label} reps`}
            </Text>
          </View>
        </View>

        {/* Description */}
        <TextInput
          style={styles.descInput}
          placeholder="Description (optional)"
          placeholderTextColor={C.textSubtle}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={2}
        />

        {/* Duration Row */}
        <View style={styles.dateRow}>
          <TouchableOpacity style={styles.dateBtn} onPress={() => setShowStartDatePicker(true)} activeOpacity={0.7}>
            <Ionicons name="calendar-outline" size={14} color={C.textSubtle} />
            <Text style={styles.dateText}>{startDate.toLocaleDateString()}</Text>
            <Text style={styles.dateLabel}>start</Text>
          </TouchableOpacity>
          <View style={styles.dateArrow}>
            <Ionicons name="arrow-forward" size={14} color={C.textSubtle} />
            <Text style={styles.daysBadge}>{daysLeft}d</Text>
          </View>
          <TouchableOpacity style={styles.dateBtn} onPress={() => setShowEndDatePicker(true)} activeOpacity={0.7}>
            <Ionicons name="calendar-outline" size={14} color={C.textSubtle} />
            <Text style={styles.dateText}>{endDate.toLocaleDateString()}</Text>
            <Text style={styles.dateLabel}>end</Text>
          </TouchableOpacity>
        </View>

        {/* Settings Row: Reward + Gender + Video */}
        <View style={styles.settingsRow}>
          {/* Reward */}
          <View style={styles.settingCard}>
            <Text style={styles.settingLabel}>Reward</Text>
            <View style={styles.rewardRow}>
              <TextInput
                style={styles.rewardInput}
                value={reward}
                onChangeText={setReward}
                keyboardType="numeric"
                placeholderTextColor={C.textSubtle}
              />
              <Text style={styles.rewardUnit}>XP</Text>
            </View>
          </View>

          {/* Gender */}
          <View style={styles.settingCard}>
            <Text style={styles.settingLabel}>Gender</Text>
            <View style={styles.genderRow}>
              {[{ v: null, l: 'All' }, { v: 'male', l: 'M' }, { v: 'female', l: 'F' }].map(opt => (
                <TouchableOpacity
                  key={String(opt.v)}
                  style={[styles.genderChip, gender === opt.v && styles.genderChipActive]}
                  onPress={() => setGender(opt.v)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.genderChipText, gender === opt.v && styles.genderChipTextActive]}>{opt.l}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Video */}
          <View style={styles.settingCard}>
            <Text style={styles.settingLabel}>Video</Text>
            <TouchableOpacity
              style={[styles.toggle, requiresVideo && styles.toggleActive]}
              onPress={() => setRequiresVideo(!requiresVideo)}
              activeOpacity={0.7}
            >
              <Ionicons name={requiresVideo ? 'checkmark' : 'close'} size={14} color={requiresVideo ? C.black : C.textSubtle} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Rules (collapsed) */}
        <TextInput
          style={styles.rulesInput}
          placeholder="Rules (optional)"
          placeholderTextColor={C.textSubtle}
          value={rules}
          onChangeText={setRules}
          multiline
          numberOfLines={2}
        />

        {/* Preview */}
        {title.trim() && target ? (
          <View style={styles.preview}>
            <View style={styles.previewHeader}>
              <Ionicons name="eye-outline" size={12} color={C.textSubtle} />
              <Text style={styles.previewLabel}>Preview</Text>
            </View>
            <Text style={styles.previewTitle}>{title}</Text>
            <Text style={styles.previewSub}>
              {selectedLiftData?.label} · {target} {meta.unit} · {reward} XP · {daysLeft} days
              {gender ? ` · ${gender === 'male' ? 'Men only' : 'Women only'}` : ''}
            </Text>
          </View>
        ) : null}

        <View style={{ height: 80 }} />
      </ScrollView>

      {showStartDatePicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          minimumDate={new Date()}
          onChange={(event, date) => { setShowStartDatePicker(false); if (date) setStartDate(date); }}
        />
      )}
      {showEndDatePicker && (
        <DateTimePicker
          value={endDate}
          mode="date"
          minimumDate={new Date(startDate.getTime() + 24 * 60 * 60 * 1000)}
          onChange={(event, date) => { setShowEndDatePicker(false); if (date) setEndDate(date); }}
        />
      )}

      <CustomAlert {...alertConfig} onClose={hideAlert} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: ADMIN_SURFACES.page,

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: S.lg,
    paddingBottom: S.md,
    backgroundColor: C.panel,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: R.sm,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  headerTitle: {
    flex: 1,
    marginLeft: S.md,
    fontSize: 16,
    fontWeight: '800',
    color: C.text,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.accent,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: R.sm,
    gap: 4,
  },
  saveBtnDisabled: { backgroundColor: C.surface },
  saveBtnText: { color: C.white, fontWeight: '800', fontSize: 12 },

  // Scroll
  scroll: { flex: 1, padding: S.lg },

  // Category tabs
  catRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  catBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    borderRadius: R.sm,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  catBtnActive: { borderColor: C.accent, backgroundColor: C.accent + '10' },
  catText: { fontSize: 12, fontWeight: '700', color: C.textSubtle },
  catTextActive: { color: C.text },

  // Exercise grid
  exerciseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  exerciseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: R.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  exerciseBtnActive: { borderColor: C.accent, backgroundColor: C.accent + '10' },
  exerciseLabel: { fontSize: 13, fontWeight: '700', color: C.textSubtle },
  exerciseLabelActive: { color: C.text },

  // Title input
  titleInput: {
    backgroundColor: C.panel,
    borderRadius: R.sm,
    padding: 14,
    color: C.text,
    fontSize: 16,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 12,
  },

  // Target row
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  targetField: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: R.sm,
    borderWidth: 2,
    borderColor: C.accent,
    overflow: 'hidden',
  },
  targetInput: {
    fontSize: 24,
    fontWeight: '900',
    color: C.text,
    padding: 12,
    textAlign: 'center',
  },
  targetUnitBadge: {
    backgroundColor: C.accent,
    borderRadius: R.sm,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  targetUnitText: { fontSize: 12, fontWeight: '800', color: C.white, letterSpacing: 1 },
  targetDesc: { flex: 1.5 },
  targetDescText: { fontSize: 11, color: C.textSubtle, fontStyle: 'italic' },

  // Description
  descInput: {
    backgroundColor: C.panel,
    borderRadius: R.sm,
    padding: 12,
    color: C.text,
    fontSize: 13,
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 12,
  },

  // Date row
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  dateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.card,
    borderRadius: R.sm,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  dateText: { fontSize: 12, fontWeight: '700', color: C.text, flex: 1 },
  dateLabel: { fontSize: 9, fontWeight: '700', color: C.textSubtle, letterSpacing: 1 },
  dateArrow: { alignItems: 'center', gap: 2 },
  daysBadge: { fontSize: 9, fontWeight: '800', color: C.accent },

  // Settings row
  settingsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  settingCard: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: R.sm,
    padding: 10,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    gap: 6,
  },
  settingLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: C.textSubtle,
    letterSpacing: 1,
  },

  // Reward
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  rewardInput: {
    fontSize: 16,
    fontWeight: '800',
    color: C.warning,
    textAlign: 'center',
    minWidth: 40,
    padding: 0,
  },
  rewardUnit: { fontSize: 10, fontWeight: '800', color: C.warning },

  // Gender
  genderRow: { flexDirection: 'row', gap: 4 },
  genderChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: R.xs,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  genderChipActive: { borderColor: C.accent, backgroundColor: C.accent + '10' },
  genderChipText: { fontSize: 11, fontWeight: '800', color: C.textSubtle },
  genderChipTextActive: { color: C.text },

  // Toggle
  toggle: {
    width: 40,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  toggleActive: { backgroundColor: C.accent, borderColor: C.accent },

  // Rules
  rulesInput: {
    backgroundColor: C.panel,
    borderRadius: R.sm,
    padding: 12,
    color: C.text,
    fontSize: 12,
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 50,
    textAlignVertical: 'top',
    marginBottom: 16,
  },

  // Preview
  preview: {
    backgroundColor: C.card,
    borderRadius: R.sm,
    padding: 14,
    borderWidth: 1,
    borderColor: C.accent + '30',
  },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  previewLabel: { fontSize: 9, fontWeight: '800', color: C.textSubtle, letterSpacing: 1.5 },
  previewTitle: { fontSize: 14, fontWeight: '800', color: C.text, marginBottom: 4 },
  previewSub: { fontSize: 11, color: C.textSubtle, lineHeight: 16 },
});
