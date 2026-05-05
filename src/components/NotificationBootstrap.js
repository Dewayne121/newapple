import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { Analytics } from '../utils/analytics';

export default function NotificationBootstrap() {
  const { isAuthenticated } = useAuth();
  const { permissionStatus, registerForPushNotificationsAsync } = useNotifications();
  const hasTrackedPermission = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    if (permissionStatus === 'granted') {
      if (!hasTrackedPermission.current) {
        Analytics.logEvent('push_permission_granted');
        hasTrackedPermission.current = true;
      }
      registerForPushNotificationsAsync({ requestIfNotGranted: false }).catch((error) => {
        console.error('Notification bootstrap registration failed:', error);
      });
    } else if (permissionStatus === 'denied') {
      if (!hasTrackedPermission.current) {
        Analytics.logEvent('push_permission_denied');
        hasTrackedPermission.current = true;
      }
    } else if (permissionStatus === 'undetermined') {
      Analytics.logEvent('push_permission_requested');
    }
  }, [isAuthenticated, permissionStatus, registerForPushNotificationsAsync]);

  return null;
}
