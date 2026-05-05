import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Modal, ActivityIndicator, TextInput, Platform, ActionSheetIOS, Image, Share, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import VideoPlayer from '../components/VideoPlayer';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useStreamlinedOnboarding } from '../context/StreamlinedOnboardingContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { getUserTier, getTierProgress } from '../constants/tiers';
import api from '../services/api';
import ScreenHeader from '../components/ScreenHeader';
import CustomAlert, { useCustomAlert } from '../components/CustomAlert';
import AccoladePickerModal from '../components/AccoladePickerModal';
import AdminProfileEditModal from '../components/AdminProfileEditModal';
import TutorialModal from '../components/TutorialModal';
import AvatarFrame from '../components/AvatarFrame';
import * as purchaseService from '../services/purchaseService';
import PurchaseModal, { BoostSelectModal } from '../components/PurchaseModal';
import { PRODUCTS, formatPrice } from '../constants/store';
import { Analytics } from '../utils/analytics';

// Conditional import for expo-video-thumbnails (not available on web)
let VideoThumbnails;
try {
  VideoThumbnails = require('expo-video-thumbnails');
} catch (e) {
  VideoThumbnails = null;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Max content width for web/desktop to maintain mobile-like layout
const MAX_CONTENT_WIDTH = 480;
const CONTENT_WIDTH = Math.min(SCREEN_WIDTH, MAX_CONTENT_WIDTH);
const IS_WIDE_SCREEN = SCREEN_WIDTH > MAX_CONTENT_WIDTH;

const LS_WORKOUT_VIDEOS = 'unyield_workout_videos';

// Profile options
const REGIONS = ['Global', 'London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow'];
const GOALS = ['Hypertrophy', 'Leanness', 'Performance'];

// Helper functions for video storage
async function getWorkoutVideos() {
  try {
    const existing = await AsyncStorage.getItem(LS_WORKOUT_VIDEOS);
    return existing ? JSON.parse(existing) : [];
  } catch (e) {
    return [];
  }
}

async function deleteWorkoutVideo(videoId, serverId, type = 'workout') {
  try {
    if (serverId) {
      if (type === 'challenge') {
        await api.deleteChallengeSubmission(serverId);
      } else {
        await api.deleteVideo(serverId);
      }
    }
    const existing = await AsyncStorage.getItem(LS_WORKOUT_VIDEOS);
    const videos = existing ? JSON.parse(existing) : [];
    const filtered = videos.filter(v => v.id !== videoId);
    await AsyncStorage.setItem(LS_WORKOUT_VIDEOS, JSON.stringify(filtered));
  } catch (e) {
    console.error('Error deleting video:', e);
    throw e;
  }
}

async function clearAllLocalVideos() {
  try {
    await AsyncStorage.removeItem(LS_WORKOUT_VIDEOS);
    return true;
  } catch (e) {
    return false;
  }
}

export default function ProfileScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { user: currentUser, weightUnit, toggleWeightUnit, heightUnit, toggleHeightUnit } = useApp();
  const { signOut, deleteAccount, updateUserProfile, refreshUser } = useAuth();
  const { showTutorial, setShowTutorial, tutorialTopic } = useStreamlinedOnboarding();

  // Profile state
  const [viewedUser, setViewedUser] = useState(null);
  const [isOwnProfile, setIsOwnProfile] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [workoutVideos, setWorkoutVideos] = useState([]);
  const [videoThumbnails, setVideoThumbnails] = useState({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const videoRef = useRef(null);
  const thumbnailRequestsRef = useRef(new Set());

  // Edit Profile Modal state
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Edit form fields
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editRegion, setEditRegion] = useState('Global');
  const [editGoal, setEditGoal] = useState('Hypertrophy');
  const [editProfileImage, setEditProfileImage] = useState(null);
  const [editFitnessLevel, setEditFitnessLevel] = useState(null);
  const [editWorkoutFrequency, setEditWorkoutFrequency] = useState(null);
  const [editPreferredDays, setEditPreferredDays] = useState([]);
  const [editWeight, setEditWeight] = useState('');
  const [editHeight, setEditHeight] = useState('');
  const [editAge, setEditAge] = useState('');

  // Settings modal state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showRankHighlightPurchase, setShowRankHighlightPurchase] = useState(false);
  const [showBoostPurchase, setShowBoostPurchase] = useState(false);
  const [showBoostConfirm, setShowBoostConfirm] = useState(false);
  const [pendingBoost, setPendingBoost] = useState(null);
  const [activeBoost, setActiveBoost] = useState(null);
  const [inviteCodes, setInviteCodes] = useState([]);
  const [inviteLimits, setInviteLimits] = useState({
    maxInviteCodes: 3,
    remainingInviteCodes: 3,
    isUnlimitedInvites: false,
  });
  const [loadingInviteCodes, setLoadingInviteCodes] = useState(false);
  const [generatingInviteCode, setGeneratingInviteCode] = useState(false);

  // Change password modal state
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  // Profile picture upload state
  const [uploadingProfilePicture, setUploadingProfilePicture] = useState(false);

  // Custom alert state
  const { alertConfig, showAlert, hideAlert } = useCustomAlert();

  // Admin state
  const [showAccoladePicker, setShowAccoladePicker] = useState(false);
  const [showAdminEditModal, setShowAdminEditModal] = useState(false);

  const routeUserParam = route?.params?.userId ?? route?.params?.id ?? route?.params?.user;
  const resolvedRouteUserId = typeof routeUserParam === 'string' || typeof routeUserParam === 'number'
    ? String(routeUserParam)
    : String(routeUserParam?.id ?? routeUserParam?._id ?? '');
  const userId = resolvedRouteUserId || null;
  const currentUserId = currentUser?.id ?? currentUser?._id;
  const isViewingOtherUser = Boolean(userId && String(userId) !== String(currentUserId));

  const isAdmin = currentUser?.accolades?.includes('admin');

  useEffect(() => {
    const loadUserProfile = async () => {
      setIsOwnProfile(!isViewingOtherUser);
      if (isViewingOtherUser) {
        if (viewedUser && (viewedUser.id === userId || viewedUser._id === userId)) {
          setLoadingProfile(false);
          return;
        }
        setViewedUser(null);
        setLoadingProfile(true);
        try {
          const response = await api.getUserById(userId);
          if (response.success && response.data) setViewedUser(response.data);
          else setViewedUser(null);
        } catch (err) { setViewedUser(null); }
        finally { setLoadingProfile(false); }
      } else {
        setLoadingProfile(true);
        try {
          const response = await api.getProfile();
          if (response.success && response.data) setViewedUser(response.data);
          else setViewedUser(currentUser);
        } catch (error) { setViewedUser(currentUser); }
        finally { setLoadingProfile(false); }
      }
    };
    loadUserProfile();
  }, [isViewingOtherUser, userId]);

  useFocusEffect(
    useCallback(() => {
      const refreshOnFocus = async () => {
        if (!isViewingOtherUser && refreshUser) {
          const refreshedUser = await refreshUser();
          if (refreshedUser) setViewedUser(refreshedUser);
        } else if (userId) {
          const response = await api.getUserById(userId);
          if (response.success && response.data) setViewedUser(response.data);
        }
      };
      refreshOnFocus().catch(() => {});
      setActiveBoost(purchaseService.getActiveBoost());
      Analytics.logEvent('profile_viewed', { viewed_user_id: viewedUser?._id || viewedUser?.id || currentUser?._id || currentUser?.id, viewed_username: viewedUser?.username || currentUser?.username, source: isViewingOtherUser ? 'other_profile' : 'own_profile' });
    }, [isViewingOtherUser, refreshUser, userId])
  );

  const loadWorkoutVideos = useCallback(async () => {
    try {
      let allVideos = [];
      if (!isViewingOtherUser) {
        const videoResponse = await api.getMyVideos();
        let challengeResponse = { success: false, data: [] };
        try { challengeResponse = await api.getMyChallengeSubmissions(); } catch (e) {}

        if (videoResponse.success && videoResponse.data) {
          allVideos.push(...videoResponse.data.map(v => ({
            id: v.id || v._id || v.serverId || v.videoUrl || v.videoUri,
            serverId: v.id || v._id || v.serverId,
            uri: v.videoUrl,
            exercise: v.exercise,
            reps: v.reps,
            weight: v.weight,
            date: v.createdAt,
            points: v.reps * 10,
            duration: v.duration,
            status: v.status,
            approved: v.status === 'approved',
            type: 'workout',
          })));
        }

        if (challengeResponse.success && challengeResponse.data) {
          allVideos.push(...challengeResponse.data.map(v => ({
            id: v.id || v._id || v.serverId || v.videoUrl || v.videoUri,
            serverId: v.id || v._id || v.serverId,
            uri: v.videoUrl,
            exercise: v.exercise,
            reps: v.reps,
            weight: v.weight,
            date: v.submittedAt || v.createdAt,
            points: v.value || 0,
            status: v.status,
            approved: v.status === 'approved',
            type: 'challenge',
            challengeTitle: v.challenge?.title,
            blurStatus: v.blurStatus || 'none',
            blurStartedAt: v.blurStartedAt,
            blurCompletedAt: v.blurCompletedAt,
            blurError: v.blurError,
          })));
        }

        allVideos.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (allVideos.length === 0) {
          const localVideos = await getWorkoutVideos();
          allVideos = localVideos.map(v => ({
            ...v,
            id: v.id || v._id || v.serverId || v.uri,
            status: v.status || 'pending',
            type: 'workout',
          }));
        }
        setWorkoutVideos(allVideos);
      } else if (userId) {
        const response = await api.getUserVideos(userId);
        if (response.success && response.data) {
          setWorkoutVideos(response.data.map(v => ({
            id: v.id || v._id || v.serverId || v.videoUrl || v.videoUri,
            serverId: v.id || v._id || v.serverId,
            uri: v.videoUrl,
            exercise: v.exercise,
            reps: v.reps,
            weight: v.weight,
            date: v.submittedAt || v.createdAt,
            points: v.type === 'challenge' ? (v.value || 0) : ((v.reps || 0) * 10),
            status: v.status,
            approved: v.status === 'approved',
            type: v.type,
          })));
        } else {
          setWorkoutVideos([]);
        }
      }
    } catch (err) {
      if (!isViewingOtherUser) {
        const videos = await getWorkoutVideos();
        setWorkoutVideos(videos);
      } else {
        setWorkoutVideos([]);
      }
    }
  }, [isViewingOtherUser, userId]);

  useFocusEffect(useCallback(() => { loadWorkoutVideos(); }, [loadWorkoutVideos]));
  useEffect(() => { if (refreshKey > 0) loadWorkoutVideos(); }, [refreshKey, loadWorkoutVideos]);

  useEffect(() => {
    let isCancelled = false;
    const generateThumbnails = async () => {
      const pendingVideos = workoutVideos.filter((video) => {
        if (!video?.uri || videoThumbnails[video.id] || thumbnailRequestsRef.current.has(video.id)) return false;
        return true;
      });

      for (const video of pendingVideos) {
        thumbnailRequestsRef.current.add(video.id);
        try {
          if (VideoThumbnails) {
            const { uri } = await VideoThumbnails.getThumbnailAsync(video.uri, { time: 500 });
            if (!isCancelled && uri) setVideoThumbnails(prev => ({ ...prev, [video.id]: uri }));
          }
        } catch (error) {}
      }
    };
    generateThumbnails();
    return () => { isCancelled = true; };
  }, [workoutVideos, videoThumbnails]);

  const loadInviteCodes = useCallback(async () => {
    if (isViewingOtherUser) return;
    setLoadingInviteCodes(true);
    try {
      const response = await api.getMyInviteCodes();
      if (response.success && response.data) {
        setInviteCodes(response.data.inviteCodes || []);
        setInviteLimits({
          maxInviteCodes: response.data.maxInviteCodes ?? 3,
          remainingInviteCodes: response.data.remainingInviteCodes ?? 0,
          isUnlimitedInvites: response.data.isUnlimitedInvites === true,
        });
      }
    } catch (error) {} 
    finally { setLoadingInviteCodes(false); }
  }, [isViewingOtherUser]);

  useEffect(() => {
    if (showSettingsModal && !isViewingOtherUser) loadInviteCodes().catch(() => {});
  }, [showSettingsModal, isViewingOtherUser, loadInviteCodes]);

  const handleBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Home');
  };

  const handleEditProfile = () => {
    setEditName(viewedUser?.name || '');
    setEditBio(viewedUser?.bio || '');
    setEditRegion(viewedUser?.region || 'Global');
    setEditGoal(viewedUser?.goal || 'Hypertrophy');
    setEditProfileImage(viewedUser?.profileImage || null);
    setEditFitnessLevel(viewedUser?.fitnessLevel || 'beginner');
    setEditWorkoutFrequency(viewedUser?.workoutFrequency || '3-4');
    setEditPreferredDays(viewedUser?.preferredDays || []);
    setEditAge(viewedUser?.age ? String(viewedUser.age) : '');

    let w = viewedUser?.weight;
    if (w && weightUnit === 'lbs') w = Math.round(w * 2.20462);
    setEditWeight(w ? String(w) : '');

    let h = viewedUser?.height;
    if (h && heightUnit === 'ft') h = (h * 0.0328084).toFixed(2);
    setEditHeight(h ? String(h) : '');

    setShowSettingsModal(false);
    setShowEditProfileModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditProfileModal(false);
    resetEditForm();
    // Small delay to let the modal animation complete before re-opening settings
    setTimeout(() => setShowSettingsModal(true), 100);
  };

  const resetEditForm = () => {
    setEditName('');
    setEditBio('');
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      return showAlert({ title: 'ERROR', message: 'DISPLAY NAME IS REQUIRED.', icon: 'error', buttons: [{ text: 'OK', style: 'default' }] });
    }

    if (!editWeight || !parseFloat(editWeight) || parseFloat(editWeight) <= 0) {
      return showAlert({ title: 'WEIGHT REQUIRED', message: 'WEIGHT IS REQUIRED FOR COMPETITION FEATURES. ENTER YOUR WEIGHT.', icon: 'warning', buttons: [{ text: 'OK', style: 'default' }] });
    }

    setSavingProfile(true);
    try {
      const updates = {
        name: editName.trim(),
        bio: editBio.trim(),
        region: editRegion,
        goal: editGoal,
        fitnessLevel: editFitnessLevel,
        workoutFrequency: editWorkoutFrequency,
        preferredDays: editPreferredDays,
      };

      if (editProfileImage && editProfileImage !== viewedUser?.profileImage) updates.profileImage = editProfileImage;

      let w = parseFloat(editWeight);
      if (!isNaN(w) && w > 0) {
        if (weightUnit === 'lbs') w = w / 2.20462;
        updates.weight = Math.round(w * 10) / 10;
      }

      if (editHeight) {
        let h = parseFloat(editHeight);
        if (!isNaN(h)) {
          if (heightUnit === 'ft') h = h / 0.0328084;
          updates.height = Math.round(h);
        }
      }

      if (editAge) {
        const a = parseInt(editAge);
        if (!isNaN(a)) updates.age = a;
      }

      const result = await updateUserProfile(updates);
      if (result.success) {
        Analytics.logEvent('profile_updated', { fields_changed: ['profile'] });
        setViewedUser(result.data);
        setRefreshKey(prev => prev + 1);
        setShowEditProfileModal(false);
        // Small delay to let the modal animation complete before re-opening settings
        setTimeout(() => setShowSettingsModal(true), 100);
        showAlert({ title: 'SUCCESS', message: 'PROFILE UPDATED SUCCESSFULLY.', icon: 'success', buttons: [{ text: 'OK', style: 'default' }] });
      } else {
        showAlert({ title: 'ERROR', message: 'FAILED TO UPDATE PROFILE.', icon: 'error', buttons: [{ text: 'OK', style: 'default' }] });
      }
    } catch (e) {
      showAlert({ title: 'ERROR', message: 'FAILED TO UPDATE PROFILE.', icon: 'error', buttons: [{ text: 'OK', style: 'default' }] });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangeProfilePicture = async () => {
    const options = ['Take Photo', 'Choose from Library', 'Cancel'];
    const cancelButtonIndex = 2;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex },
        async (buttonIndex) => {
          if (buttonIndex === 0) await handleTakePhoto();
          else if (buttonIndex === 1) await handleChooseFromLibrary();
        }
      );
    } else {
      showAlert({
        title: 'CHANGE PROFILE PICTURE',
        message: 'CHOOSE HOW TO ADD YOUR PHOTO',
        buttons: [
          { text: 'CAMERA', style: 'default', onPress: handleTakePhoto },
          { text: 'GALLERY', style: 'default', onPress: handleChooseFromLibrary },
        ]
      });
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showAlert({ title: 'PERMISSION REQUIRED', message: 'GRANT CAMERA PERMISSION TO PROCEED.', icon: 'warning', buttons: [{ text: 'OK', style: 'default' }] });
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });
      if (!result.canceled && result.assets[0]?.base64) await uploadProfilePicture(result.assets[0].base64);
    } catch (error) {
      showAlert({ title: 'ERROR', message: 'FAILED TO TAKE PHOTO.', icon: 'error', buttons: [{ text: 'OK', style: 'default' }] });
    }
  };

  const handleChooseFromLibrary = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert({ title: 'PERMISSION REQUIRED', message: 'GRANT PHOTO LIBRARY PERMISSION TO PROCEED.', icon: 'warning', buttons: [{ text: 'OK', style: 'default' }] });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });
      if (!result.canceled && result.assets[0]?.base64) await uploadProfilePicture(result.assets[0].base64);
    } catch (error) {
      showAlert({ title: 'ERROR', message: 'FAILED TO SELECT IMAGE.', icon: 'error', buttons: [{ text: 'OK', style: 'default' }] });
    }
  };

  const uploadProfilePicture = async (base64) => {
    setUploadingProfilePicture(true);
    try {
      const base64Image = `data:image/jpeg;base64,${base64}`;
      const updateResult = await updateUserProfile({ profileImage: base64Image });
      if (updateResult.success) {
        setViewedUser(updateResult.data);
        await refreshUser();
        showAlert({ title: 'SUCCESS', message: 'PROFILE PICTURE UPDATED.', icon: 'success', buttons: [{ text: 'OK', style: 'default' }] });
      } else {
        throw new Error(updateResult.error || 'Failed to update profile picture');
      }
    } catch (error) {
      showAlert({ title: 'UPLOAD FAILED', message: error.message || 'FAILED TO UPDATE PROFILE PICTURE.', icon: 'error', buttons: [{ text: 'OK', style: 'default' }] });
    } finally {
      setUploadingProfilePicture(false);
    }
  };

  const handleDeleteVideo = (video) => {
    showAlert({
      title: 'DELETE EVIDENCE',
      message: 'THIS ACTION IS PERMANENT. DELETE THIS LOG?',
      icon: 'warning',
      buttons: [
        { text: 'CANCEL', style: 'cancel' },
        { text: 'DELETE', style: 'destructive', onPress: async () => {
          try {
            await deleteWorkoutVideo(video.id, video.serverId, video.type);
            setRefreshKey(prev => prev + 1);
          } catch (e) {
            showAlert({ title: 'ERROR', message: 'FAILED TO DELETE LOG.', icon: 'error', buttons: [{ text: 'OK', style: 'default' }] });
          }
        }}
      ]
    });
  };

  const handleClearLocalVideos = async () => {
    showAlert({
      title: 'CLEAR CACHE',
      message: 'REMOVE LOCALLY CACHED DATA. SERVER DATA REMAINS INTACT.',
      icon: 'warning',
      buttons: [
        { text: 'CANCEL', style: 'cancel' },
        { text: 'CLEAR', style: 'destructive', onPress: async () => {
            await clearAllLocalVideos();
            setRefreshKey(prev => prev + 1);
        }}
      ]
    });
  };

  const handleShareInviteCode = async (code) => {
    await new Promise(resolve => setTimeout(resolve, 100));
    try {
      await Share.share({ message: `Join me on UNYIELD. Use this invite code: ${code}` });
    } catch (error) {
      showAlert({ title: 'ERROR', message: 'COULD NOT OPEN SHARING OPTIONS.', icon: 'error', buttons: [{ text: 'OK', style: 'default' }] });
    }
  };

  const handleGenerateInviteCode = async () => {
    if (generatingInviteCode || (!inviteLimits.isUnlimitedInvites && inviteLimits.remainingInviteCodes <= 0)) return;
    setGeneratingInviteCode(true);
    try {
      const response = await api.generateInviteCode();
      if (response.success && response.data?.inviteCode?.code) {
        const code = response.data.inviteCode.code;
        await loadInviteCodes();
        showAlert({
          title: 'INVITE CODE READY',
          message: `SHARE THIS CODE: ${code}`,
          icon: 'success',
          buttons: [
            { text: 'SHARE', style: 'default', onPress: () => handleShareInviteCode(code) },
            { text: 'DONE', style: 'default' },
          ],
        });
        return;
      }
      throw new Error('Failed to generate invite code');
    } catch (error) {
      showAlert({ title: 'ERROR', message: error.message || 'COULD NOT GENERATE INVITE CODE.', icon: 'error', buttons: [{ text: 'OK', style: 'default' }] });
    } finally {
      setGeneratingInviteCode(false);
    }
  };

  const handleDeleteAccount = () => {
    setShowSettingsModal(false);
    setTimeout(() => {
      Alert.alert('DELETE ACCOUNT', 'THIS IS PERMANENT. ALL DATA WILL BE LOST.', [
        { text: 'CANCEL', style: 'cancel' },
        { text: 'DELETE', style: 'destructive', onPress: () => deleteAccount() },
      ]);
    }, 400);
  };

  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showRegionModal, setShowRegionModal] = useState(false);

  const handleQuickChangeGoal = () => setShowGoalModal(true);
  const handleSelectGoal = async (goal) => {
    setShowGoalModal(false);
    const res = await updateUserProfile({ goal });
    if(res.success) {
      setViewedUser(prev => ({ ...prev, goal }));
      setRefreshKey(prev => prev + 1);
    }
  };

  const handleQuickChangeRegion = () => setShowRegionModal(true);
  const handleSelectRegion = async (region) => {
    setShowRegionModal(false);
    const res = await updateUserProfile({ region });
    if(res.success) {
      setViewedUser(prev => ({ ...prev, region }));
      setRefreshKey(prev => prev + 1);
    }
  };

  const handleManageAccolades = () => setShowAccoladePicker(true);
  const handleAdminEditProfile = () => setShowAdminEditModal(true);
  const handleUserUpdated = (updatedUser) => {
    setViewedUser(prev => ({ ...prev, ...updatedUser }));
    setRefreshKey(prev => prev + 1);
  };

  const handleChangePassword = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setShowPasswords(false);
    setShowChangePasswordModal(true);
    setShowSettingsModal(false);
  };

  const handleClosePasswordModal = () => {
    setShowChangePasswordModal(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    // Small delay to let the modal animation complete before re-opening settings
    setTimeout(() => setShowSettingsModal(true), 100);
  };

  const handleSavePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('ALL FIELDS ARE REQUIRED');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('NEW PASSWORD MUST BE AT LEAST 6 CHARACTERS');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('NEW PASSWORDS DO NOT MATCH');
      return;
    }
    if (currentPassword === newPassword) {
      setPasswordError('NEW PASSWORD MUST BE DIFFERENT');
      return;
    }

    setChangingPassword(true);
    setPasswordError('');

    try {
      const response = await api.changePassword(currentPassword, newPassword);
      if (response.success) {
        setShowChangePasswordModal(false);
        // Small delay to let the modal animation complete before re-opening settings
        setTimeout(() => setShowSettingsModal(true), 100);
        showAlert({ title: 'SUCCESS', message: 'PASSWORD CHANGED SUCCESSFULLY.', icon: 'success', buttons: [{ text: 'OK', style: 'default' }] });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (error) {
      setPasswordError(error.message || 'FAILED TO CHANGE PASSWORD');
    } finally {
      setChangingPassword(false);
    }
  };

  if (loadingProfile || !viewedUser) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#ff2d55" />
      </View>
    );
  }

  const displayName = viewedUser?.name || viewedUser?.username || 'OPERATOR';
  const handle = viewedUser?.username ? `@${viewedUser.username}` : '@' + displayName.toLowerCase().replace(/\s/g, '_');
  const workouts = viewedUser?.logs?.length || 0;
  const points = viewedUser?.totalPoints || 0;
  const streak = viewedUser?.streak || 0;
  const bio = viewedUser?.bio || '';

  const formatPoints = (p) => p >= 1000 ? (p / 1000).toFixed(1) + 'K' : p.toString();

  const userTier = getUserTier(points);
  const tierProgress = getTierProgress(points);
  const bestStreak = viewedUser?.streakBest || 0;

  const userAccolades = viewedUser?.accolades || [];
  const accoladeConfig = {
    admin: { label: 'ADMIN', color: '#ff2d55', icon: 'shield' },
    community_support: { label: 'SUPPORT', color: '#3B82F6', icon: 'people' },
    beta: { label: 'BETA TESTER', color: '#8B5CF6', icon: 'flask' },
    staff: { label: 'STAFF', color: '#10B981', icon: 'construct' },
    verified_athlete: { label: 'VERIFIED ATHLETE', color: '#F59E0B', icon: 'checkmark-circle' },
    founding_member: { label: 'FOUNDER', color: '#D4AF37', icon: 'star' },
    challenge_master: { label: 'CHALLENGE MASTER', color: '#6366F1', icon: 'trophy' },
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="PROFILE"
        subtitle={isOwnProfile ? "PERSONNEL FILE" : "INTEL DOSSIER"}
        showBackButton={true}
        onBackPress={handleBack}
        rightAction={!isOwnProfile && isAdmin ? (
          <View style={styles.adminActions}>
            <TouchableOpacity onPress={handleAdminEditProfile} style={styles.adminActionBtn} activeOpacity={0.8}>
              <Ionicons name="create-outline" size={20} color="#fafafa" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleManageAccolades} style={styles.adminActionBtn} activeOpacity={0.8}>
              <Ionicons name="shield-checkmark" size={20} color="#ff2d55" />
            </TouchableOpacity>
          </View>
        ) : isOwnProfile ? (
          <TouchableOpacity onPress={() => setShowSettingsModal(true)} style={styles.iconBtn} activeOpacity={0.8}>
            <Ionicons name="settings-sharp" size={20} color="#fafafa" />
          </TouchableOpacity>
        ) : null}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHero}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={isOwnProfile ? handleChangeProfilePicture : undefined}
            activeOpacity={isOwnProfile ? 0.8 : 1}
            disabled={!isOwnProfile}
          >
            <AvatarFrame
              size={100}
              imageUri={viewedUser?.profileImage}
              fallbackText={displayName.substring(0, 2).toUpperCase()}
              frameId={isOwnProfile ? purchaseService.getActiveFrame() : 'bronze'}
            />
            <Image source={userTier.image} style={styles.tierBadgeImage} resizeMode="contain" />
            {isOwnProfile && (
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={14} color="#fafafa" />
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.userName}>{displayName.toUpperCase()}</Text>
          <Text style={styles.userHandle}>{handle.toUpperCase()}</Text>

          {userAccolades.length > 0 && (
            <View style={styles.accoladesContainer}>
              {userAccolades.map(accolade => {
                const config = accoladeConfig[accolade];
                if (!config) return null;
                return (
                  <View key={accolade} style={[styles.accoladeBadge, { borderColor: config.color }]}>
                    <Ionicons name={config.icon} size={10} color={config.color} />
                    <Text style={[styles.accoladeText, { color: config.color }]}>{config.label}</Text>
                  </View>
                );
              })}
            </View>
          )}

          <View style={styles.bioSection}>
             {bio ? (
               <Text style={styles.bioText}>{bio.toUpperCase()}</Text>
             ) : isOwnProfile ? (
               <TouchableOpacity onPress={handleEditProfile} activeOpacity={0.8}>
                 <Text style={styles.bioPlaceholder}>[ ADD BIO ]</Text>
               </TouchableOpacity>
             ) : null}
          </View>
        </View>

        {/* Progress Panel - HUD Style */}
        <View style={styles.tacticalDataBlock}>
          <View style={styles.progressHeader}>
            <View style={styles.tierInfo}>
              <Image source={userTier.image} style={styles.progressTierImage} resizeMode="contain" />
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.tierName, { color: userTier.color }]}>{userTier.name.toUpperCase()}</Text>
                  {activeBoost && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(255, 215, 0, 0.1)', borderWidth: 1, borderColor: 'rgba(255, 215, 0, 0.3)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                      <Ionicons name="flash" size={10} color="#FFD700" />
                      <Text style={{ fontSize: 9, fontFamily: 'SpaceGroteskBold', color: '#FFD700', letterSpacing: 0.5 }}>1.5X</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.tierPoints}>{formatPoints(points)} XP</Text>
              </View>
            </View>
            {tierProgress.nextTier ? (
              <Text style={styles.nextTierLabel}>
                [{tierProgress.current.toLocaleString()} / {tierProgress.target.toLocaleString()}]
              </Text>
            ) : (
              <Text style={styles.maxTierLabel}>[ MAX TIER ]</Text>
            )}
          </View>
          <View style={styles.hudProgressTrackOuter}>
            <View style={styles.hudProgressTrackInner}>
              <View
                style={[
                  styles.hudProgressFill,
                  { width: `${tierProgress.percentage}%`, backgroundColor: userTier.color }
                ]}
              />
            </View>
          </View>
        </View>

        {/* Stats Matrix */}
        <View style={[styles.tacticalDataBlock, styles.statsMatrix]}>
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{workouts}</Text>
            <Text style={styles.statLabel}>LOGS</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statVal, { color: '#ff2d55' }]}>{formatPoints(points)}</Text>
            <Text style={styles.statLabel}>MERIT</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <View style={styles.streakRow}>
              <Ionicons name="flame" size={16} color="#ff4500" />
              <Text style={[styles.statVal, { color: '#ff4500' }]}>{streak}</Text>
            </View>
            <Text style={styles.statLabel}>STREAK</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statVal, { color: '#D4AF37' }]}>{bestStreak}</Text>
            <Text style={styles.statLabel}>BEST</Text>
          </View>
        </View>

        {/* Info Grid */}
        <View style={styles.infoGrid}>
           <TouchableOpacity 
             style={styles.infoCard} 
             onPress={isOwnProfile ? handleQuickChangeRegion : null} 
             activeOpacity={isOwnProfile ? 0.8 : 1}
           >
              <View style={styles.infoIconContainer}>
                <Ionicons name="location" size={18} color="#ff2d55" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>REGION</Text>
                <Text style={styles.infoValue} numberOfLines={1}>{(viewedUser?.region || 'UNKNOWN').toUpperCase()}</Text>
              </View>
           </TouchableOpacity>

           <TouchableOpacity
             style={styles.infoCard}
             onPress={isOwnProfile ? handleQuickChangeGoal : null}
             activeOpacity={isOwnProfile ? 0.8 : 1}
           >
              <View style={styles.infoIconContainer}>
                <Ionicons name="flag" size={18} color="#ff2d55" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>OBJECTIVE</Text>
                <Text style={styles.infoValue} numberOfLines={1}>{(viewedUser?.goal || 'CLASSIFIED').toUpperCase()}</Text>
              </View>
           </TouchableOpacity>

           <View style={styles.infoCard}>
              <View style={styles.infoIconContainer}>
                <Ionicons name="barbell" size={18} color="#ff2d55" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>WEIGHT</Text>
                <Text style={styles.infoValue}>
                  {viewedUser?.weight
                    ? (weightUnit === 'lbs'
                        ? `${Math.round(viewedUser.weight * 2.20462)} LBS`
                        : `${viewedUser.weight} KG`)
                    : '--'
                  }
                </Text>
              </View>
           </View>

           <View style={styles.infoCard}>
              <View style={styles.infoIconContainer}>
                <Ionicons name="resize" size={18} color="#ff2d55" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>HEIGHT</Text>
                <Text style={styles.infoValue}>
                  {viewedUser?.height
                    ? (heightUnit === 'ft'
                        ? `${(viewedUser.height * 0.0328084).toFixed(1)} FT`
                        : `${viewedUser.height} CM`)
                    : '--'
                  }
                </Text>
              </View>
           </View>
        </View>

        {/* Workout Videos Section */}
        {workoutVideos.length > 0 && (
          <View style={styles.videosSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>EVIDENCE LOG</Text>
              <Text style={styles.sectionCount}>[{workoutVideos.length}]</Text>
            </View>

            <View style={styles.videosGrid}>
              {workoutVideos.map((video, index) => {
                const thumbnailUri = video.thumbnailUrl || videoThumbnails[video.id];
                const videoKey = video.id || video.serverId || video.uri || `video-${index}`;
                return (
                  <TouchableOpacity
                    key={videoKey}
                    style={styles.videoCard}
                    onPress={() => setSelectedVideo(video)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.videoThumbnail}>
                      {thumbnailUri ? (
                        <Image source={{ uri: thumbnailUri }} style={styles.videoThumbnailImage} resizeMode="cover" />
                      ) : (
                        <View style={styles.videoThumbnailFallback}>
                          <Ionicons name="videocam" size={24} color="#52525b" />
                        </View>
                      )}
                      <View style={styles.videoOverlay}>
                         <View style={styles.videoStatus}>
                            {video.approved ? (
                                <Ionicons name="checkmark-sharp" size={14} color="#10B981" />
                            ) : video.status === 'rejected' ? (
                                <Ionicons name="close-sharp" size={14} color="#ff2d55" />
                            ) : (
                                <Ionicons name="time-sharp" size={14} color="#F59E0B" />
                            )}
                         </View>
                         {/* Blur Status Indicator */}
                         {video.type === 'challenge' && video.blurStatus !== 'none' && (
                           <View style={styles.videoStatus}>
                             {video.blurStatus === 'processing' && (
                               <>
                                   <Ionicons name="time-sharp" size={14} color="#F59E0B" />
                                 </>
                               )}
                             {video.blurStatus === 'blurred' && (
                               <>
                                   <Ionicons name="checkmark-sharp" size={14} color="#10B981" />
                                 </>
                               )}
                             {video.blurStatus === 'failed' && (
                               <>
                                   <Ionicons name="alert-circle-sharp" size={14} color="#ff2d55" />
                                 </>
                               )}
                           </View>
                         )}
                      </View>
                      {isOwnProfile && (
                        <TouchableOpacity
                          style={styles.videoDeleteButton}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleDeleteVideo(video);
                          }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="trash" size={14} color="#ff2d55" />
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text style={styles.videoExercise} numberOfLines={1}>{video.exercise.toUpperCase()}</Text>
                    <Text style={styles.videoMeta}>{video.reps}X • +{video.points} XP</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        <View style={{ height: 130 }} />
      </ScrollView>

      {/* Settings Modal */}
      <Modal visible={showSettingsModal} transparent animationType="fade" onRequestClose={() => setShowSettingsModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowSettingsModal(false)}>
          <TouchableOpacity style={styles.brutalistSheet} activeOpacity={1} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>SYSTEM SETTINGS</Text>

            <ScrollView style={styles.settingsScroll} showsVerticalScrollIndicator={false}>
              {(userAccolades.includes('admin') || userAccolades.includes('community_support')) && (
                  <TouchableOpacity style={styles.settingItem} activeOpacity={0.8} onPress={() => { setShowSettingsModal(false); navigation.navigate('AdminDashboard'); }}>
                      <Ionicons name="shield" size={20} color="#ff2d55" />
                      <Text style={[styles.settingText, { color: '#ff2d55' }]}>ADMIN PANEL</Text>
                  </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.settingItem} activeOpacity={0.8} onPress={handleEditProfile}>
                 <Ionicons name="person" size={20} color="#fafafa" />
                 <Text style={styles.settingText}>EDIT PROFILE</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.settingItem} activeOpacity={0.8} onPress={() => { setShowSettingsModal(false); navigation.navigate('ProfileFrameStore'); Analytics.logEvent('frame_equipped', { frame_id: purchaseService.getActiveFrame(), frame_name: purchaseService.getActiveFrame() }); }}>
                 <Ionicons name="color-wand-outline" size={20} color="#FFD700" />
                 <Text style={[styles.settingText, { color: '#FFD700' }]}>PROFILE FRAMES</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.settingItem} activeOpacity={0.8} onPress={() => { if (purchaseService.hasRankHighlight()) { Alert.alert('Rank Highlight', 'Your rank highlight is active! It will expire on ' + new Date(purchaseService.getRankHighlightExpiry()).toLocaleDateString()); } else { setShowSettingsModal(false); setShowRankHighlightPurchase(true); } }}>
                 <Ionicons name="star" size={20} color={purchaseService.hasRankHighlight() ? '#FFD700' : '#fafafa'} />
                 <View style={{ flex: 1 }}>
                   <Text style={styles.settingText}>RANK HIGHLIGHT</Text>
                   <Text style={{ fontSize: 10, fontFamily: 'SpaceGrotesk', color: '#71717a', marginTop: 1 }}>
                     {purchaseService.hasRankHighlight() ? 'Active' : `${formatPrice(PRODUCTS.RANK_HIGHLIGHT.price)} / week`}
                   </Text>
                 </View>
                 {purchaseService.hasRankHighlight() ? (
                   <Ionicons name="checkmark-circle" size={20} color="#FFD700" />
                 ) : (
                   <Ionicons name="chevron-forward" size={20} color="#52525b" />
                 )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.settingItem} activeOpacity={0.8} onPress={() => { setShowSettingsModal(false); setShowBoostPurchase(true); }}>
                 <Ionicons name="flash" size={20} color={activeBoost ? '#FFD700' : '#fafafa'} />
                 <View style={{ flex: 1 }}>
                   <Text style={styles.settingText}>XP BOOST</Text>
                   <Text style={{ fontSize: 10, fontFamily: 'SpaceGrotesk', color: '#71717a', marginTop: 1 }}>
                     {activeBoost ? `1.5x active` : 'Multiply your XP'}
                   </Text>
                 </View>
                 <Ionicons name="chevron-forward" size={20} color="#52525b" />
              </TouchableOpacity>

              {isOwnProfile && (
                <>
                  <TouchableOpacity
                    style={styles.settingItem}
                    activeOpacity={0.8}
                    onPress={handleGenerateInviteCode}
                    disabled={generatingInviteCode || (!inviteLimits.isUnlimitedInvites && inviteLimits.remainingInviteCodes <= 0)}
                  >
                    <Ionicons
                      name="ticket"
                      size={20}
                      color={inviteLimits.isUnlimitedInvites || inviteLimits.remainingInviteCodes > 0 ? '#fafafa' : '#27272a'}
                    />
                    <View style={styles.settingTextWrap}>
                      <Text style={[styles.settingText, (!inviteLimits.isUnlimitedInvites && inviteLimits.remainingInviteCodes <= 0) && { color: '#a1a1aa' }]}>
                        GENERATE INVITE
                      </Text>
                      <Text style={styles.settingSubText}>
                        {inviteLimits.isUnlimitedInvites
                          ? 'UNLIMITED (ADMIN)'
                          : `[${inviteLimits.remainingInviteCodes}/${inviteLimits.maxInviteCodes}] REMAINING`}
                      </Text>
                    </View>
                    {generatingInviteCode ? (
                      <ActivityIndicator color="#ff2d55" />
                    ) : (
                      <Ionicons
                        name="add-sharp"
                        size={24}
                        color={inviteLimits.isUnlimitedInvites || inviteLimits.remainingInviteCodes > 0 ? '#ff2d55' : '#27272a'}
                      />
                    )}
                  </TouchableOpacity>

                  <View style={styles.inviteCodesList}>
                    {loadingInviteCodes ? (
                      <ActivityIndicator color="#ff2d55" />
                    ) : inviteCodes.length > 0 ? (
                      inviteCodes.map((invite) => (
                        <View key={invite.id} style={styles.inviteCodeRow}>
                          <View style={styles.inviteCodeMain}>
                            <Text style={styles.inviteCodeText}>{invite.code}</Text>
                            <Text style={[styles.inviteCodeStatus, invite.isUsed && styles.inviteCodeStatusUsed]}>
                              {invite.isUsed ? 'USED' : 'READY'}
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => handleShareInviteCode(invite.code)}
                            disabled={invite.isUsed}
                            style={styles.inviteShareButton}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="share-social" size={16} color={invite.isUsed ? '#27272a' : '#fafafa'} />
                          </TouchableOpacity>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.inviteEmptyText}>NO INVITE CODES GENERATED.</Text>
                    )}
                  </View>
                </>
              )}

              {viewedUser?.provider === 'email' && (
              <TouchableOpacity style={styles.settingItem} activeOpacity={0.8} onPress={handleChangePassword}>
                 <Ionicons name="lock-closed" size={20} color="#fafafa" />
                 <Text style={styles.settingText}>CHANGE PASSWORD</Text>
              </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.settingItem} activeOpacity={0.8} onPress={toggleWeightUnit}>
                 <Ionicons name="scale" size={20} color="#fafafa" />
                 <Text style={styles.settingText}>UNIT: {weightUnit.toUpperCase()}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.settingItem}
                activeOpacity={0.8}
                onPress={() => { setShowSettingsModal(false); navigation.navigate('Notifications'); }}
              >
                 <Ionicons name="notifications" size={20} color="#fafafa" />
                 <Text style={styles.settingText}>NOTIFICATION CENTER</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.settingItem}
                activeOpacity={0.8}
                onPress={() => { setShowSettingsModal(false); navigation.navigate('NotificationSettings'); }}
              >
                 <Ionicons name="options" size={20} color="#fafafa" />
                 <Text style={styles.settingText}>NOTIFICATION SETTINGS</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.settingItem}
                activeOpacity={0.8}
                onPress={() => { setShowSettingsModal(false); setShowTutorial(true); }}
              >
                 <Ionicons name="help-circle" size={20} color="#fafafa" />
                 <Text style={styles.settingText}>TUTORIAL</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.settingItem} activeOpacity={0.8} onPress={handleClearLocalVideos}>
                 <Ionicons name="trash" size={20} color="#fafafa" />
                 <Text style={styles.settingText}>CLEAR CACHE</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.settingItem} activeOpacity={0.8} onPress={() => navigation.navigate('DebugNotifications')}>
                 <Ionicons name="bug" size={20} color="#ff2d55" />
                 <Text style={[styles.settingText, { color: '#ff2d55' }]}>DEBUG NOTIFICATIONS</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.settingItem} activeOpacity={0.8} onPress={signOut}>
                 <Ionicons name="log-out" size={20} color="#ff2d55" />
                 <Text style={[styles.settingText, { color: '#ff2d55' }]}>SIGN OUT</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.settingItem, { borderBottomWidth: 0 }]} activeOpacity={0.8} onPress={handleDeleteAccount}>
                 <Ionicons name="warning" size={20} color="#a1a1aa" />
                 <Text style={[styles.settingText, { color: '#a1a1aa' }]}>DELETE ACCOUNT</Text>
              </TouchableOpacity>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal visible={showEditProfileModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleCloseEditModal}>
        <View style={styles.editModalContainer}>
          <View style={styles.editModalContent}>
            <View style={styles.editModalHeader}>
                <TouchableOpacity onPress={handleCloseEditModal} activeOpacity={0.8}>
                    <Text style={styles.editModalCancelText}>CANCEL</Text>
                </TouchableOpacity>
                <Text style={styles.editModalTitle}>EDIT PROFILE</Text>
                <TouchableOpacity onPress={handleSaveProfile} disabled={savingProfile} activeOpacity={0.8}>
                    {savingProfile ? <ActivityIndicator color="#ff2d55" /> : <Text style={styles.editModalSaveText}>SAVE</Text>}
                </TouchableOpacity>
            </View>
            <ScrollView style={styles.editModalScroll} showsVerticalScrollIndicator={false}>
                <View style={styles.formCard}>
                    <Text style={styles.cardLabel}>PUBLIC INFO</Text>
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>DISPLAY NAME</Text>
                        <TextInput style={styles.modernInput} value={editName} onChangeText={setEditName} placeholder="ENTER NAME" placeholderTextColor="#a1a1aa" />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>BIO</Text>
                        <TextInput style={[styles.modernInput, styles.textArea]} value={editBio} onChangeText={setEditBio} placeholder="ENTER BIO" placeholderTextColor="#a1a1aa" multiline />
                    </View>
                </View>

                <View style={styles.formCard}>
                    <Text style={styles.cardLabel}>STATS</Text>
                    <View style={styles.statsRow}>
                        <View style={styles.statInputWrap}>
                            <Text style={styles.statInputLabel}>WEIGHT ({weightUnit.toUpperCase()})</Text>
                            <TextInput style={styles.statInput} value={editWeight} onChangeText={setEditWeight} keyboardType="decimal-pad" placeholder="--" placeholderTextColor="#a1a1aa" />
                        </View>
                        <View style={styles.statInputWrap}>
                            <Text style={styles.statInputLabel}>HEIGHT ({(heightUnit || 'cm').toUpperCase()})</Text>
                            <TextInput style={styles.statInput} value={editHeight} onChangeText={setEditHeight} keyboardType="decimal-pad" placeholder="--" placeholderTextColor="#a1a1aa" />
                        </View>
                    </View>
                </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal visible={showChangePasswordModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClosePasswordModal}>
        <View style={styles.editModalContainer}>
          <View style={styles.editModalContent}>
            <View style={styles.editModalHeader}>
              <TouchableOpacity onPress={handleClosePasswordModal} activeOpacity={0.8}>
                <Text style={styles.editModalCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <Text style={styles.editModalTitle}>CHANGE PASSWORD</Text>
              <TouchableOpacity onPress={handleSavePassword} disabled={changingPassword} activeOpacity={0.8}>
                {changingPassword ? <ActivityIndicator color="#ff2d55" /> : <Text style={styles.editModalSaveText}>SAVE</Text>}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.editModalScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.formCard}>
                <Text style={styles.cardLabel}>SECURITY</Text>

                {passwordError ? (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert" size={16} color="#ff2d55" />
                    <Text style={styles.errorText}>{passwordError.toUpperCase()}</Text>
                  </View>
                ) : null}

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>CURRENT PASSWORD</Text>
                  <View style={styles.passwordInputContainer}>
                    <TextInput
                      style={styles.modernInput}
                      value={currentPassword}
                      onChangeText={setCurrentPassword}
                      placeholder="ENTER CURRENT PASSWORD"
                      placeholderTextColor="#a1a1aa"
                      secureTextEntry={!showPasswords}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPasswords(!showPasswords)}>
                      <Ionicons name={showPasswords ? "eye-off" : "eye"} size={20} color="#a1a1aa" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>NEW PASSWORD</Text>
                  <View style={styles.passwordInputContainer}>
                    <TextInput
                      style={styles.modernInput}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="ENTER NEW PASSWORD"
                      placeholderTextColor="#a1a1aa"
                      secureTextEntry={!showPasswords}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>CONFIRM NEW PASSWORD</Text>
                  <View style={styles.passwordInputContainer}>
                    <TextInput
                      style={styles.modernInput}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="RE-ENTER NEW PASSWORD"
                      placeholderTextColor="#a1a1aa"
                      secureTextEntry={!showPasswords}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>

                <View style={styles.infoBox}>
                  <Ionicons name="information-circle" size={16} color="#a1a1aa" />
                  <Text style={styles.infoText}>MINIMUM 6 CHARACTERS REQUIRED</Text>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Goal Selection Modal */}
      <Modal visible={showGoalModal} transparent animationType="fade" onRequestClose={() => setShowGoalModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowGoalModal(false)}>
          <View style={styles.brutalistSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>SELECT OBJECTIVE</Text>
            {GOALS.map(goal => (
              <TouchableOpacity key={goal} style={styles.selectionItem} activeOpacity={0.8} onPress={() => handleSelectGoal(goal)}>
                <Text style={[styles.selectionText, viewedUser?.goal === goal && styles.selectionTextActive]}>
                  {goal.toUpperCase()}
                </Text>
                {viewedUser?.goal === goal && <Ionicons name="checkmark-sharp" size={20} color="#ff2d55" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Region Selection Modal */}
      <Modal visible={showRegionModal} transparent animationType="fade" onRequestClose={() => setShowRegionModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowRegionModal(false)}>
          <View style={styles.brutalistSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>SELECT REGION</Text>
            {REGIONS.map(region => (
              <TouchableOpacity key={region} style={styles.selectionItem} activeOpacity={0.8} onPress={() => handleSelectRegion(region)}>
                <Text style={[styles.selectionText, viewedUser?.region === region && styles.selectionTextActive]}>
                  {region.toUpperCase()}
                </Text>
                {viewedUser?.region === region && <Ionicons name="checkmark-sharp" size={20} color="#ff2d55" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Video Modal */}
      <Modal visible={selectedVideo !== null} animationType="fade" onRequestClose={() => setSelectedVideo(null)}>
        <View style={styles.videoModalContainer}>
          <TouchableOpacity style={styles.videoModalClose} onPress={() => setSelectedVideo(null)}>
            <Ionicons name="close" size={32} color="#fafafa" />
          </TouchableOpacity>
          {selectedVideo && (
            <VideoPlayer source={selectedVideo.uri} style={styles.videoPlayer} />
          )}
        </View>
      </Modal>

      {/* Uploading Progress Overlay */}
      {uploadingProfilePicture && (
        <Modal visible={uploadingProfilePicture} transparent animationType="fade">
          <View style={styles.uploadLoadingOverlay}>
            <View style={styles.uploadLoadingCard}>
              <ActivityIndicator size="large" color="#ff2d55" />
              <Text style={styles.uploadLoadingText}>UPLOADING IMAGE...</Text>
            </View>
          </View>
        </Modal>
      )}

      {/* Shared Components */}
      <CustomAlert {...alertConfig} onClose={hideAlert} />

      {/* Rank Highlight Purchase */}
      <PurchaseModal
        visible={showRankHighlightPurchase}
        onClose={() => setShowRankHighlightPurchase(false)}
        product={{
          name: PRODUCTS.RANK_HIGHLIGHT.label,
          description: PRODUCTS.RANK_HIGHLIGHT.description,
          price: PRODUCTS.RANK_HIGHLIGHT.price,
        }}
        onPurchaseComplete={async () => {
          await purchaseService.purchaseRankHighlight();
          setShowRankHighlightPurchase(false);
          showAlert({ title: 'Active!', message: 'Your rank is now highlighted on leaderboards for 7 days.', icon: 'success', buttons: [{ text: 'Got it', style: 'default' }] });
        }}
      />

      {/* XP Boost Selection */}
      <BoostSelectModal
        visible={showBoostPurchase}
        onClose={() => setShowBoostPurchase(false)}
        onSelect={(boost) => {
          setPendingBoost(boost);
          setShowBoostPurchase(false);
          setShowBoostConfirm(true);
        }}
      />

      {/* XP Boost Purchase Confirmation */}
      <PurchaseModal
        visible={showBoostConfirm}
        onClose={() => { setShowBoostConfirm(false); setPendingBoost(null); }}
        product={{
          name: pendingBoost ? pendingBoost.name : '',
          description: pendingBoost?.description,
          price: pendingBoost?.price,
        }}
        onPurchaseComplete={async () => {
          if (!pendingBoost) return;
          await purchaseService.purchaseXpBoost(pendingBoost.id, pendingBoost.price, pendingBoost.durationHours, pendingBoost.multiplier);
          setActiveBoost(purchaseService.getActiveBoost());
          setShowBoostConfirm(false);
          setPendingBoost(null);
          showAlert({ title: 'Boosted!', message: `1.5x XP active for ${pendingBoost.durationHours === 1 ? '1 hour' : '24 hours'}!`, icon: 'success', buttons: [{ text: 'Nice', style: 'default' }] });
        }}
      />

      {!isOwnProfile && isAdmin && (
        <>
          <AccoladePickerModal
            visible={showAccoladePicker}
            onClose={() => setShowAccoladePicker(false)}
            userId={viewedUser?.id || viewedUser?._id}
            currentAccolades={viewedUser?.accolades || []}
            onAccoladesUpdated={handleUserUpdated}
            api={api}
          />
          <AdminProfileEditModal
            visible={showAdminEditModal}
            onClose={() => setShowAdminEditModal(false)}
            user={viewedUser}
            onUserUpdated={handleUserUpdated}
            api={api}
          />
        </>
      )}

      <TutorialModal topic={tutorialTopic} visible={showTutorial} onClose={() => setShowTutorial(false)} />
    </View>
  );
}

// -------------------------------------------------------------
// STYLESHEET: Cyber Neon Theme
// -------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b'
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  iconBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#121214',
    borderWidth: 2,
    borderColor: '#27272a'
  },
  adminActions: {
    flexDirection: 'row',
    gap: 8
  },
  adminActionBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#121214',
    borderWidth: 2,
    borderColor: '#27272a'
  },
  scroll: {
    flex: 1
  },
  scrollContent: {
    alignSelf: 'center',
    width: CONTENT_WIDTH,
    maxWidth: MAX_CONTENT_WIDTH
  },

  // --- Hero Section ---
  profileHero: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20
  },
  avatarContainer: {
    marginBottom: 16
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#27272a',
    backgroundColor: '#18181b'
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatarInitials: {
    fontSize: 36,
    fontWeight: '900',
    fontFamily: 'SpaceGroteskBold',
    color: '#a1a1aa',
    letterSpacing: 2
  },
  tierBadgeImage: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#09090b',
    backgroundColor: '#18181b'
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -8,
    left: -8,
    backgroundColor: '#ff2d55',
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#09090b'
  },
  userName: {
    fontSize: 24,
    fontWeight: '900',
    fontFamily: 'SpaceGroteskBold',
    color: '#fafafa',
    letterSpacing: 1,
    marginBottom: 4
  },
  userHandle: {
    fontSize: 11,
    color: '#a1a1aa',
    fontWeight: '800',
    fontFamily: 'SpaceGroteskSemiBold',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  // --- Bio & Accolades ---
  bioSection: {
    marginTop: 16,
    paddingHorizontal: 32
  },
  bioText: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: 'SpaceGroteskSemiBold',
    color: '#a1a1aa',
    textAlign: 'center',
    lineHeight: 18,
    letterSpacing: 1
  },
  bioPlaceholder: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: 'SpaceGroteskSemiBold',
    color: '#a1a1aa',
    letterSpacing: 1
  },
  accoladesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16
  },
  accoladeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
    borderWidth: 1,
    backgroundColor: '#18181b'
  },
  accoladeText: {
    fontSize: 9,
    fontWeight: '900',
    fontFamily: 'SpaceGroteskBold',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // --- Tactical Data Blocks ---
  tacticalDataBlock: {
    backgroundColor: '#121214',
    marginHorizontal: 16,
    marginTop: 24,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#27272a',
  },

  // --- HUD Progress Panel ---
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  tierInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  progressTierImage: {
    width: 44,
    height: 44
  },
  tierName: {
    fontSize: 16,
    fontWeight: '900',
    fontFamily: 'SpaceGroteskBold',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  tierPoints: {
    fontSize: 10,
    color: '#a1a1aa',
    fontWeight: '800',
    fontFamily: 'SpaceGroteskSemiBold',
    marginTop: 2,
    letterSpacing: 1
  },
  nextTierLabel: {
    fontSize: 10,
    color: '#a1a1aa',
    fontWeight: '800',
    fontFamily: 'SpaceGroteskSemiBold',
    letterSpacing: 1.5
  },
  maxTierLabel: {
    fontSize: 10,
    color: '#D4AF37',
    fontWeight: '900',
    fontFamily: 'SpaceGroteskBold',
    letterSpacing: 1.5
  },
  // HUD Nested Progress Track (Armor > Slot > Fill)
  hudProgressTrackOuter: {
    borderWidth: 1,
    borderColor: '#27272a',
    padding: 3,
    borderRadius: 12,
    backgroundColor: '#18181b'
  },
  hudProgressTrackInner: {
    height: 6,
    backgroundColor: '#18181b',
    borderRadius: 999,
    overflow: 'hidden'
  },
  hudProgressFill: {
    height: '100%',
    borderRadius: 999
  },

  // --- Stats Matrix ---
  statsMatrix: {
    flexDirection: 'row',
    marginTop: 16,
    marginBottom: 8,
    padding: 16
  },
  statItem: {
    flex: 1,
    alignItems: 'center'
  },
  statVal: {
    fontSize: 22,
    fontWeight: '900',
    fontFamily: 'SpaceGroteskBold',
    color: '#fafafa',
    marginBottom: 4,
    letterSpacing: -0.5
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'SpaceGroteskSemiBold',
    color: '#a1a1aa',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#27272a'
  },

  // --- Info Grid (Tactical Cards) ---
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 12,
    justifyContent: 'space-between'
  },
  infoCard: {
    width: IS_WIDE_SCREEN ? '48%' : (CONTENT_WIDTH - 44) / 2,
    minWidth: 150,
    backgroundColor: '#121214',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272a',
    flexDirection: 'row',
    alignItems: 'center'
  },
  infoIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#18181b',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#27272a'
  },
  infoContent: {
    flex: 1
  },
  infoLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#a1a1aa',
    marginBottom: 2,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '900',
    color: '#fafafa',
    letterSpacing: 0.5
  },

  // --- Evidence Log (Videos) ---
  videosSection: {
    paddingHorizontal: 16,
    marginTop: 32
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    alignItems: 'center'
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#a1a1aa',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '900',
    color: '#ff2d55',
    letterSpacing: 1
  },
  videosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    justifyContent: 'flex-start'
  },
  videoCard: {
    width: IS_WIDE_SCREEN ? '31%' : (CONTENT_WIDTH - 32 - 24) / 3,
    minWidth: 100,
    maxWidth: 140,
    marginHorizontal: 4,
    marginBottom: 16
  },
  videoThumbnail: {
    aspectRatio: 1,
    backgroundColor: '#121214',
    borderRadius: 12, // Smooth curve
    overflow: 'hidden',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#27272a'
  },
  videoThumbnailImage: {
    width: '100%',
    height: '100%'
  },
  videoThumbnailFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  videoOverlay: {
    position: 'absolute',
    top: 6,
    left: 6
  },
  videoStatus: {
    backgroundColor: 'rgba(5, 5, 5, 0.85)',
    padding: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#27272a'
  },
  videoDeleteButton: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(5, 5, 5, 0.85)',
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ff2d55'
  },
  videoExercise: {
    fontSize: 10,
    fontWeight: '900',
    color: '#fafafa',
    marginBottom: 2,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  videoMeta: {
    fontSize: 9,
    fontWeight: '800',
    color: '#a1a1aa',
    letterSpacing: 1
  },

  // --- Settings & Selection Modals (Brutalist Sheets) ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 5, 5, 0.92)',
    justifyContent: 'flex-end',
    alignItems: 'center'
  },
  brutalistSheet: {
    backgroundColor: '#121214',
    borderTopWidth: 3,
    borderTopColor: '#27272a',
    padding: 24,
    maxHeight: '80%',
    width: IS_WIDE_SCREEN ? MAX_CONTENT_WIDTH : '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    borderRadius: 20, // Top corners smooth
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  settingsScroll: {
    flexGrow: 0
  },
  sheetHandle: {
    width: 48,
    height: 4,
    backgroundColor: '#27272a',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 24
  },
  sheetTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#a1a1aa',
    marginBottom: 16,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
    gap: 16
  },
  settingText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fafafa',
    letterSpacing: 1
  },
  settingTextWrap: {
    flex: 1
  },
  settingSubText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#a1a1aa',
    marginTop: 4,
    letterSpacing: 1
  },
  inviteCodesList: {
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
    paddingBottom: 12
  },
  inviteCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12
  },
  inviteCodeMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  inviteCodeText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#fafafa',
    letterSpacing: 2
  },
  inviteCodeStatus: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: '900',
    letterSpacing: 1.5
  },
  inviteCodeStatusUsed: {
    color: '#a1a1aa'
  },
  inviteShareButton: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#18181b',
    borderWidth: 2,
    borderColor: '#27272a'
  },
  inviteEmptyText: {
    color: '#a1a1aa',
    fontSize: 10,
    fontWeight: '800',
    paddingVertical: 8,
    letterSpacing: 1
  },
  selectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a'
  },
  selectionText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#a1a1aa',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  selectionTextActive: {
    color: '#fafafa'
  },

  // --- Edit Profile / Password Modals ---
  editModalContainer: {
    flex: 1,
    backgroundColor: '#09090b',
    alignItems: 'center'
  },
  editModalContent: {
    width: IS_WIDE_SCREEN ? MAX_CONTENT_WIDTH : '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    flex: 1
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#27272a',
    backgroundColor: '#121214'
  },
  editModalTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#fafafa',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  editModalCancelText: {
    color: '#a1a1aa',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1
  },
  editModalSaveText: {
    color: '#ff2d55',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1
  },
  editModalScroll: {
    flex: 1,
    padding: 16
  },
  formCard: {
    marginBottom: 24,
    backgroundColor: '#121214',
    padding: 16,
    borderRadius: 16,
    borderTopWidth: 2,
    borderTopColor: '#27272a',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: '#a1a1aa',
    marginBottom: 16,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  inputGroup: {
    marginBottom: 16
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#a1a1aa',
    marginBottom: 8,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  modernInput: {
    backgroundColor: '#121214',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#27272a',
    padding: 16,
    color: '#fafafa',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top'
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16
  },
  statInputWrap: {
    flex: 1
  },
  statInputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#a1a1aa',
    marginBottom: 8,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  statInput: {
    backgroundColor: '#121214',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#27272a',
    padding: 16,
    color: '#fafafa',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.5
  },

  // --- Video Player Modal ---
  videoModalContainer: {
    flex: 1,
    backgroundColor: '#09090b',
    justifyContent: 'center'
  },
  videoModalClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(20, 20, 20, 0.85)',
    padding: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#27272a'
  },
  fullScreenVideo: {
    width: '100%',
    height: '100%'
  },
  videoPlayer: {
    flex: 1,
  },

  // --- Error & Information Boxes ---
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a0a0a',
    borderLeftWidth: 4,
    borderLeftColor: '#ff2d55',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    gap: 10
  },
  errorText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#ff2d55',
    flex: 1,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  passwordInputContainer: {
    position: 'relative'
  },
  eyeIcon: {
    position: 'absolute',
    right: 16,
    top: 16
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121214',
    borderWidth: 1,
    borderColor: '#27272a',
    padding: 14,
    borderRadius: 12,
    gap: 10,
    marginTop: 8
  },
  infoText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#a1a1aa',
    flex: 1,
    letterSpacing: 1
  },

  // --- Upload Loading Overlay ---
  uploadLoadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 5, 5, 0.92)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  uploadLoadingCard: {
    backgroundColor: '#121214',
    padding: 28,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#27272a',
    alignItems: 'center',
    minWidth: 220
  },
  uploadLoadingText: {
    color: '#fafafa',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 16,
    textAlign: 'center',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});
