import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { StreamlinedOnboardingProvider } from '../context/StreamlinedOnboardingContext';
import { SKINS } from '../constants/colors';
import { NavigationService } from './NavigationService';
import { Analytics } from '../utils/analytics';

// Screens
import SplashScreen from '../screens/SplashScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import { StreamlinedOnboardingNavigator } from '../screens/onboarding/streamlined';
import DashboardScreen from '../screens/DashboardScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import ProfileScreen from '../screens/ProfileScreen';
import TrainingNavigator from './TrainingNavigator';
import CompeteScreen from '../screens/CompeteScreen';
import ChallengeDetailScreen from '../screens/ChallengeDetailScreen';
import ChallengeSubmissionScreen from '../screens/ChallengeSubmissionScreen';
import WorkoutSubmitScreen from '../screens/WorkoutSubmitScreen';
import WorkoutSummaryScreen from '../screens/WorkoutSummaryScreen';
import TrainingReportScreen from '../screens/TrainingReportScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import CoreLiftLeaderboardScreen from '../screens/CoreLiftLeaderboardScreen';

// Admin Screens
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import UserManagementScreen from '../screens/admin/UserManagementScreen';
import UserDetailScreen from '../screens/admin/UserDetailScreen';
import VideoModerationScreen from '../screens/admin/VideoModerationScreen';
import AppealsManagementScreen from '../screens/admin/AppealsManagementScreen';
import ReportsManagementScreen from '../screens/admin/ReportsManagementScreen';
import AnalyticsScreen from '../screens/admin/AnalyticsScreen';
import ChallengeManagementScreen from '../screens/admin/ChallengeManagementScreen';
import ChallengeBuilderScreen from '../screens/admin/ChallengeBuilderScreen';
import AdminSendNotificationScreen from '../screens/admin/AdminSendNotificationScreen';
import DebugNotificationScreen from '../screens/DebugNotificationScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ------------------------------------------------------------------
// TAB ITEM
// ------------------------------------------------------------------

const TabItem = ({ route, isFocused, onPress, tabConfig }) => (
  <TouchableOpacity
    accessibilityRole="button"
    accessibilityState={isFocused ? { selected: true } : {}}
    onPress={onPress}
    activeOpacity={0.7}
    style={styles.tabItemWrapper}
  >
    <View style={styles.tabItemInner}>
      {isFocused && <View style={styles.tabIndicatorTop} />}
      <Ionicons
        name={isFocused ? tabConfig.icon : (tabConfig.iconOutline || tabConfig.icon)}
        size={isFocused ? 20 : 18}
        color={isFocused ? '#DC2626' : '#52525b'}
      />
      <Text
        style={[styles.tabLabel, isFocused && styles.tabLabelFocused]}
        numberOfLines={1}
        allowFontScaling={false}
      >
        {tabConfig.label}
      </Text>
    </View>
  </TouchableOpacity>
);

// ------------------------------------------------------------------
// FLOATING TAB BAR
// ------------------------------------------------------------------

function TabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();

  const tabs = {
    'Base': { icon: 'home', iconOutline: 'home-outline', label: 'Home' },
    'Training': { icon: 'barbell', iconOutline: 'barbell-outline', label: 'Train' },
    'Compete': { icon: 'trophy', iconOutline: 'trophy-outline', label: 'Compete' },
    'Leagues': { icon: 'ribbon', iconOutline: 'ribbon-outline', label: 'Ranks' },
    'Stats': { icon: 'person', iconOutline: 'person-outline', label: 'Stats' },
  };

  return (
    <View style={styles.floatingBarOuter}>
      <View style={[
        styles.floatingBar,
        { marginBottom: Math.max(insets.bottom, 8) },
      ]}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const tabConfig = tabs[route.name] || { icon: 'square', label: route.name };

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          return (
            <TabItem
              key={route.key}
              route={route}
              index={index}
              isFocused={isFocused}
              onPress={onPress}
              tabConfig={tabConfig}
            />
          );
        })}
      </View>
    </View>
  );
}

function Tabs() {
  const { theme } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: '#09090b' }}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          sceneContainerStyle: { paddingBottom: 0 }
        }}
        tabBar={(props) => <TabBar {...props} />}
      >
        <Tab.Screen name="Base" component={DashboardScreen} options={{ tabBarLabel: 'Base' }} />
        <Tab.Screen name="Training" component={TrainingNavigator} options={{ tabBarLabel: 'Training' }} />
        <Tab.Screen name="Compete" component={CompeteScreen} options={{ tabBarLabel: 'Compete' }} />
        <Tab.Screen name="Leagues" component={LeaderboardScreen} options={{ tabBarLabel: 'Leagues' }} />
        <Tab.Screen name="Stats" component={ProfileScreen} options={{ tabBarLabel: 'Stats' }} />
      </Tab.Navigator>
    </View>
  );
}

function RootNavigator() {
  const { isReady, user } = useApp();
  const { loading: authLoading, isAuthenticated, onboardingCompleted } = useAuth();

  if (!isReady || authLoading) {
    return <SplashScreen />;
  }

  return (
    <>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
        ) : !onboardingCompleted ? (
          <Stack.Screen name="Onboarding" component={StreamlinedOnboardingNavigator} />
        ) : (
          <Stack.Screen name="Main" component={Tabs} />
        )}

      {/* Overlays & Modals */}
      <Stack.Screen name="LogModal" component={WorkoutSubmitScreen} options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="WorkoutSummary" component={WorkoutSummaryScreen} options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="CalendarLog" component={TrainingReportScreen} options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ presentation: 'card' }} />

      {/* Challenge Routes */}
      <Stack.Screen name="ChallengeDetail" component={ChallengeDetailScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="ChallengeSubmission" component={ChallengeSubmissionScreen} options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="CoreLiftLeaderboard" component={CoreLiftLeaderboardScreen} options={{ presentation: 'card' }} />

      {/* Admin Routes */}
      <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="AdminUsers" component={UserManagementScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="AdminUserDetail" component={UserDetailScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="AdminVideoModeration" component={VideoModerationScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="AdminAppeals" component={AppealsManagementScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="AdminReports" component={ReportsManagementScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="AdminAnalytics" component={AnalyticsScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="AdminChallenges" component={ChallengeManagementScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="AdminNotifications" component={AdminSendNotificationScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="AdminSendNotification" component={AdminSendNotificationScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="AdminChallengeBuilder" component={ChallengeBuilderScreen} options={{ presentation: 'card' }} />
      <Stack.Screen name="DebugNotifications" component={DebugNotificationScreen} options={{ presentation: 'card' }} />
    </Stack.Navigator>
    </>
  );
}

export default function AppNavigator() {
  const { theme } = useTheme();
  const routeNameRef = React.useRef();

  const navTheme = {
    ...DefaultTheme,
    colors: { ...DefaultTheme.colors, background: theme.bgDeep },
  };

  return (
    <StreamlinedOnboardingProvider>
      <NavigationContainer
        ref={(navigator) => {
          if (navigator) {
            NavigationService.setTopLevelNavigator(navigator);
          }
        }}
        theme={navTheme}
        onReady={() => {
          routeNameRef.current = NavigationService.getRef()?.getCurrentRoute()?.name;
        }}
        onStateChange={async () => {
          const previousRouteName = routeNameRef.current;
          const currentRouteName = NavigationService.getRef()?.getCurrentRoute()?.name;

          if (previousRouteName !== currentRouteName) {
            await Analytics.logScreenView(currentRouteName);
          }
          routeNameRef.current = currentRouteName;
        }}
      >
        <RootNavigator />
      </NavigationContainer>
    </StreamlinedOnboardingProvider>
  );
}

// ------------------------------------------------------------------
// STYLES — Tab Bar matching dashboard zinc aesthetic
// ------------------------------------------------------------------
const styles = StyleSheet.create({
  floatingBarOuter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  floatingBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: '#121214',
    borderWidth: 1,
    borderColor: '#27272a',
    paddingVertical: 4,
    borderRadius: 20,
    overflow: 'hidden',
  },

  tabItemWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  tabItemInner: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabIndicatorTop: {
    position: 'absolute',
    top: -10,
    left: '20%',
    right: '20%',
    height: 2,
    backgroundColor: '#DC2626',
    borderRadius: 1,
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: '600',
    fontFamily: 'SpaceGroteskSemiBold',
    color: '#52525b',
    marginTop: 3,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  tabLabelFocused: {
    color: '#DC2626',
  },
});
