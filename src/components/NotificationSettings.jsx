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
  const [preferences, setPreferences] = useState({
    eventReminders: true,
    kpiReminders: true,
    eventChanges: true,
    systemAlerts: true,
    monthlySummary: true
  });

  useEffect(() => {
    if (currentUser) {
      loadNotificationSettings();
    }
  }, [currentUser]);

  const loadNotificationSettings = async () => {
    try {
      // Always set status first, even before loading user data
      const notifStatus = getNotificationStatus();
      setStatus(notifStatus);
      
      const userRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data();
      
      setNotificationsEnabled(!!userData?.notificationsEnabled);
      setPreferences(prev => ({
        ...prev,
        ...userData?.notificationPreferences
      }));
      
    } catch (error) {
      console.error('Error loading notification settings:', error);
      // Still set status even if there's an error
      const notifStatus = getNotificationStatus();
      setStatus(notifStatus);
    }
  };

  const handleToggleNotifications = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      if (notificationsEnabled) {
        // Disable notifications
        await disableNotifications(currentUser);
        setNotificationsEnabled(false);
      } else {
        // Enable notifications
        const token = await setupNotifications(currentUser);
        if (token) {
          setNotificationsEnabled(true);
          // Update preferences
          const userRef = doc(db, 'users', currentUser.uid);
          await updateDoc(userRef, {
            notificationPreferences: preferences
          });
        } else {
          setErrorMsg("Failed to enable notifications. Please check your browser settings, allow notifications, and ensure you are online. If on Android, make sure Chrome is up to date and notifications are allowed for this site.");
          setNotificationsEnabled(false);
        }
      }
      // Refresh status
      const notifStatus = getNotificationStatus();
      setStatus(notifStatus);
    } catch (error) {
      setErrorMsg("An error occurred while toggling notifications: " + (error?.message || error));
      console.error('Error toggling notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePreferenceChange = async (key, value) => {
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);
    
    if (notificationsEnabled && currentUser) {
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          notificationPreferences: newPreferences
        });
      } catch (error) {
        console.error('Error updating preferences:', error);
      }
    }
  };

  const getNotificationDescription = (type) => {
    switch (type) {
      case 'eventReminders':
        return 'Get reminded 24 hours before events are due';
      case 'kpiReminders':
        return 'Weekly reminders for pending KPI assessments';
      case 'eventChanges':
        return 'Instant notifications when events are rescheduled or cancelled';
      case 'systemAlerts':
        return 'Critical system alerts and error notifications';
      case 'monthlySummary':
        return 'Monthly operational summary reports';
      default:
        return '';
    }
  };

  const permissionInfo = getPermissionMessage();

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Notification Settings
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
            <strong>Notifications are blocked.</strong> To enable them:
            <ol style={{ margin: '8px 0', paddingLeft: '20px' }}>
              <li>Click the lock or notification icon (🔒) in your browser's address bar</li>
              <li>Change notifications from "Block" to "Allow"</li>
              <li>Refresh this page and click "Allow Notifications" below</li>
            </ol>
            You can also go to your browser's settings and allow notifications for this site.
          </Alert>
        )}

        {status.supported && status.permission === 'default' && !notificationsEnabled && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <strong>Enable push notifications to stay updated!</strong>
            <br />
            Click "Allow Notifications" below to receive important reminders about events, KPI deadlines, and system updates.
          </Alert>
        )}

        <Box sx={{ mb: 3 }}>
          {!notificationsEnabled && status.supported && status.permission !== 'denied' && (
            <Box sx={{ mb: 2, textAlign: 'center' }}>
              <Button
                variant="contained"
                size="large"
                startIcon={<NotificationsIcon />}
                onClick={handleToggleNotifications}
                disabled={loading}
                sx={{ 
                  py: 1.5, 
                  px: 4,
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  background: 'linear-gradient(45deg, #7BC678 30%, #5BA055 90%)',
                  boxShadow: '0 3px 10px rgba(123, 198, 120, 0.3)',
                  '&:hover': {
                    background: 'linear-gradient(45deg, #5BA055 30%, #7BC678 90%)',
                    boxShadow: '0 4px 15px rgba(123, 198, 120, 0.4)',
                  }
                }}
              >
                {loading ? 'Enabling...' : 'Allow Notifications'}
              </Button>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Click to enable push notifications for important reminders
              </Typography>
            </Box>
          )}

          <FormControlLabel
            control={
              <Switch
                checked={notificationsEnabled}
                onChange={handleToggleNotifications}
                disabled={loading || !status.supported || status.permission === 'denied'}
              />
            }
            label="Enable Push Notifications"
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Get notified about important events, deadlines, and system updates.
          </Typography>
        </Box>

        {notificationsEnabled && (
          <>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="subtitle2" gutterBottom>
              Notification Types
            </Typography>
            <List dense>
              {Object.entries(preferences).map(([key, enabled]) => (
                <ListItem key={key} divider>
                  <ListItemText
                    primary={key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    secondary={getNotificationDescription(key)}
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      edge="end"
                      checked={enabled}
                      onChange={(e) => handlePreferenceChange(key, e.target.checked)}
                      size="small"
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </>
        )}

        <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip 
            label={`Permission: ${status.permission}`} 
            size="small" 
            color={status.permission === 'granted' ? 'success' : 'default'}
          />
          <Chip 
            label={notificationsEnabled ? 'Enabled' : 'Disabled'} 
            size="small" 
            color={notificationsEnabled ? 'success' : 'default'}
          />
        </Box>
      </CardContent>
    </Card>
  );
};

export default NotificationSettings;