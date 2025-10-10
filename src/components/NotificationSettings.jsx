import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Switch,
  FormControlLabel,
  Box,
  Alert,
  Button,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { setupNotifications, disableNotifications, getNotificationStatus } from '../utils/notifications';

const NotificationSettings = () => {
  const { currentUser } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [status, setStatus] = useState(() => {
    // Initialize status immediately to prevent null state
    try {
      return getNotificationStatus();
    } catch (error) {
      console.error('Error getting initial notification status:', error);
      return {
        supported: false,
        permission: 'default',
        messagingSupported: false
      };
    }
  });
  // Preferences hidden in simplified UI

  useEffect(() => {
    if (currentUser) {
      // Only load enabled/disabled state for simplicity
      const fetch = async () => {
        try {
          const notifStatus = getNotificationStatus();
          setStatus(notifStatus);
          const userRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userRef);
          const userData = userDoc.data();
          setNotificationsEnabled(!!userData?.notificationsEnabled);
        } catch (error) {
          console.error('Error loading notification settings:', error);
          setStatus(getNotificationStatus());
        }
      };
      fetch();
    }
  }, [currentUser]);

  const handleToggleNotifications = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      if (notificationsEnabled) {
        await disableNotifications(currentUser);
        setNotificationsEnabled(false);
      } else {
        const token = await setupNotifications(currentUser);
        if (token) {
          setNotificationsEnabled(true);
        } else {
          setErrorMsg("Failed to enable notifications. Please check your browser settings, allow notifications, and ensure you are online. If on Android, make sure Chrome is up to date and notifications are allowed for this site.");
          setNotificationsEnabled(false);
        }
      }
      setStatus(getNotificationStatus());
    } catch (error) {
      setErrorMsg("An error occurred while toggling notifications: " + (error?.message || error));
      console.error('Error toggling notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Preferences are not editable in simplified UI

  // Notification type descriptions not needed in simplified UI

  // No extra permission info in simplified UI

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Push Notifications
        </Typography>
        {errorMsg && (
          <Alert severity="error" sx={{ mb: 2 }}>{errorMsg}</Alert>
        )}
        {!status.supported && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Your browser does not support push notifications.
          </Alert>
        )}
        {status.supported && status.permission === 'denied' && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Notifications are blocked. Please allow notifications in your browser settings.
          </Alert>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
          <Switch
            checked={notificationsEnabled}
            onChange={handleToggleNotifications}
            disabled={loading || !status.supported || status.permission === 'denied'}
            inputProps={{ 'aria-label': 'Enable push notifications' }}
          />
          <Typography variant="body1">
            {notificationsEnabled ? 'Notifications are ON' : 'Notifications are OFF'}
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Toggle to receive or stop important reminders about events, KPIs, and system updates.
        </Typography>
      </CardContent>
    </Card>
  );
};

export default NotificationSettings;