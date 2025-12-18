import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  AlertTitle,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Box,
  Snackbar,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  NotificationsOff as NotificationsOffIcon,
  Settings as SettingsIcon,
  Close as CloseIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { getNotificationStatus, setupNotifications } from '../utils/notifications';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

const NotificationPrompt = ({ onNavigateToSettings }) => {
  const { currentUser } = useAuth();
  const [showPrompt, setShowPrompt] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState(null);
  const [_userPreferences, _setUserPreferences] = useState(null);
  const [loading, setLoading] = useState(false);

  const checkNotificationStatus = useCallback(async () => {
    if (!currentUser) return;
    
    console.log('NotificationPrompt: checkNotificationStatus called');
    
    try {
      const status = getNotificationStatus();
      console.log('NotificationPrompt: notification status:', status);
      setNotificationStatus(status);

      // Get user's notification preferences and settings
      const userRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        console.log('NotificationPrompt: User document not found');
        return;
      }
      
      const userData = userDoc.data();
      console.log('NotificationPrompt: user data:', { 
        role: userData.role, 
        notificationsEnabled: userData.notificationsEnabled,
        lastDismissed: userData.notificationPromptDismissed 
      });
      _setUserPreferences(userData);

      // Show prompt if conditions are met
      const shouldShow = shouldShowNotificationPrompt(status, userData);
      console.log('NotificationPrompt: should show prompt:', shouldShow);
      if (shouldShow) {
        setShowPrompt(true);
      }
    } catch (error) {
      console.error('NotificationPrompt: Error checking notification status:', error);
      // Don't show prompt if there's an error
      setShowPrompt(false);
    }
  }, [currentUser]);

  useEffect(() => {
    console.log('NotificationPrompt: currentUser changed:', !!currentUser);
    if (currentUser) {
      checkNotificationStatus();
    } else {
      // Reset states when no user
      setShowPrompt(false);
      setNotificationStatus(null);
      _setUserPreferences(null);
    }
  }, [currentUser, checkNotificationStatus]);

  const shouldShowNotificationPrompt = (status, userData) => {
    // Safety checks
    if (!status || !userData) return false;
    
    // Don't show if notifications are already enabled
    if (userData.notificationsEnabled) return false;
    
    // Don't show if browser doesn't support notifications
    if (!status.supported) return false;
    
    // Don't show if user dismissed recently (within 7 days)
    const lastDismissed = userData.notificationPromptDismissed?.toDate();
    if (lastDismissed) {
      const daysSinceDismissed = (Date.now() - lastDismissed.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) return false;
    }

    // Show if user has admin/quality roles (they need notifications for their responsibilities)
    const userRole = userData.role || '';
    const hasImportantRole = ['Admin', 'Quality', 'Owner'].includes(userRole);
    
    return hasImportantRole || status.permission === 'default';
  };

  const handleEnableNotifications = async () => {
    setLoading(true);
    try {
      const token = await setupNotifications(currentUser);
      if (token) {
        setShowPrompt(false);
        setShowDialog(false);
        // Show success message
        alert('Notifications enabled successfully! You\'ll now receive important reminders.');
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
      alert('Failed to enable notifications. Please try again or check your browser settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async () => {
    if (!currentUser) {
      setShowPrompt(false);
      return;
    }
    
    try {
      // Record that user dismissed the prompt
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        notificationPromptDismissed: new Date()
      });
      setShowPrompt(false);
    } catch (error) {
      console.error('Error dismissing prompt:', error);
      // Still hide the prompt even if we can't save the dismissal
      setShowPrompt(false);
    }
  };

  const handleOpenDialog = () => {
    setShowDialog(true);
  };

  const getPermissionMessage = () => {
    if (!notificationStatus) return null;

    switch (notificationStatus.permission) {
      case 'denied':
        return {
          severity: 'error',
          title: 'Notifications Blocked',
          message: 'You have blocked notifications. To enable them, click the lock icon in your browser\'s address bar and allow notifications.',
          canEnable: false
        };
      case 'default':
        return {
          severity: 'warning', 
          title: 'Enable Notifications?',
          message: 'Get important reminders about events, KPI deadlines, and system updates.',
          canEnable: true
        };
      case 'granted':
        return {
          severity: 'info',
          title: 'Notifications Available',
          message: 'You can enable TALC notifications to stay updated on important events.',
          canEnable: true
        };
      default:
        return null;
    }
  };

  const permissionInfo = getPermissionMessage();

  console.log('NotificationPrompt render:', { 
    showPrompt, 
    permissionInfo: !!permissionInfo, 
    currentUser: !!currentUser 
  });

  if (!showPrompt || !permissionInfo) {
    return null;
  }

  return (
    <>
      {/* Debug: Always show a test button in development */}
      {import.meta.env.DEV && (
        <Alert severity="info" sx={{ mb: 1 }}>
          🔧 Debug: NotificationPrompt component loaded. 
          Current user: {currentUser ? 'Yes' : 'No'}, 
          Show prompt: {showPrompt ? 'Yes' : 'No'}
          <Button size="small" onClick={() => setShowPrompt(true)} sx={{ ml: 1 }}>
            Force Show Prompt
          </Button>
        </Alert>
      )}

      {/* Compact prompt bar */}
      <Snackbar
        open={showPrompt}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ mt: 8 }}
      >
        <Alert
          severity={permissionInfo.severity}
          action={
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              {permissionInfo.canEnable && (
                <Button
                  color="inherit"
                  size="small"
                  onClick={handleOpenDialog}
                  startIcon={<SettingsIcon />}
                >
                  Enable
                </Button>
              )}
              <IconButton
                size="small"
                color="inherit"
                onClick={handleDismiss}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          }
          sx={{ alignItems: 'center' }}
        >
          <AlertTitle>{permissionInfo.title}</AlertTitle>
          {permissionInfo.message}
        </Alert>
      </Snackbar>

      {/* Detailed dialog */}
      <Dialog 
        open={showDialog} 
        onClose={() => setShowDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <NotificationsOffIcon color="primary" />
            Enable Notifications
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" paragraph>
            Stay on top of your TALC responsibilities with push notifications:
          </Typography>
          
          <List dense>
            <ListItem>
              <ListItemIcon>
                <CheckIcon color="success" fontSize="small" />
              </ListItemIcon>
              <ListItemText 
                primary="Event Reminders"
                secondary="24-hour advance notice for upcoming events"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckIcon color="success" fontSize="small" />
              </ListItemIcon>
              <ListItemText 
                primary="KPI Deadlines"
                secondary="Weekly reminders for pending assessments"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckIcon color="success" fontSize="small" />
              </ListItemIcon>
              <ListItemText 
                primary="Event Changes"
                secondary="Instant alerts for cancellations or reschedules"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckIcon color="success" fontSize="small" />
              </ListItemIcon>
              <ListItemText 
                primary="System Updates"
                secondary="Important announcements and operational summaries"
              />
            </ListItem>
          </List>

          {notificationStatus?.permission === 'denied' && (
            <Alert severity="error" sx={{ mt: 2 }}>
              <AlertTitle>Browser Settings Required</AlertTitle>
              <Typography variant="body2">
                Notifications are currently blocked. To enable them:
              </Typography>
              <Typography variant="body2" component="ol" sx={{ mt: 1, pl: 2 }}>
                <li>Click the lock or notification icon in your browser's address bar</li>
                <li>Change notifications from "Block" to "Allow"</li>
                <li>Refresh this page and try again</li>
              </Typography>
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDialog(false)}>
            Maybe Later
          </Button>
          {notificationStatus?.permission === 'denied' ? (
            <Button 
              variant="contained" 
              onClick={onNavigateToSettings}
              startIcon={<SettingsIcon />}
            >
              Go to Settings
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={handleEnableNotifications}
              disabled={loading}
              startIcon={loading ? null : <CheckIcon />}
            >
              {loading ? 'Enabling...' : 'Enable Notifications'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};

export default NotificationPrompt;