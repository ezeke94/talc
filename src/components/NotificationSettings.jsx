import React, { useState, useEffect, useCallback } from 'react';
import { getMessaging, getToken } from 'firebase/messaging';
import { replaceAllDevicesWithToken } from '../utils/deviceManager';
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
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import DeleteIcon from '@mui/icons-material/Delete';
import ComputerIcon from '@mui/icons-material/Computer';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import TabletIcon from '@mui/icons-material/Tablet';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/Edit';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { setupNotifications, disableNotifications, getNotificationStatus } from '../utils/notifications';
import { 
  getUserDevices, 
  getDeviceName, 
  toggleDevice, 
  removeDevice, 
  formatDeviceDate,
  parseDeviceInfo,
  updateDeviceName,
  cleanupDuplicateDevices
} from '../utils/deviceManager';

const NotificationSettings = ({ compact = false }) => {
  const { currentUser } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [devices, setDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [currentDeviceToken, setCurrentDeviceToken] = useState(null);
  const [deviceNameDialogOpen, setDeviceNameDialogOpen] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [editingDevice, setEditingDevice] = useState(null);
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

  const loadDevices = useCallback(async () => {
    if (!currentUser) {
      console.log('NotificationSettings: No current user, skipping device load');
      return;
    }
    
    console.log('NotificationSettings: Loading devices for user:', currentUser.uid);
    setLoadingDevices(true);
    try {
      // First, clean up any duplicate devices
      const duplicatesRemoved = await cleanupDuplicateDevices(currentUser.uid);
      if (duplicatesRemoved > 0) {
        console.log(`NotificationSettings: Cleaned up ${duplicatesRemoved} duplicate devices`);
      }
      
      // Then load the devices
      const userDevices = await getUserDevices(currentUser.uid);
      console.log('NotificationSettings: Loaded devices:', userDevices);
      console.log('NotificationSettings: Device count:', userDevices.length);
      setDevices(userDevices);
      console.log('NotificationSettings: State updated with', userDevices.length, 'devices');
    } catch (error) {
      console.error('NotificationSettings: Error loading devices:', error);
      setErrorMsg('Failed to load devices. Please refresh the page.');
    } finally {
      setLoadingDevices(false);
      console.log('NotificationSettings: Loading complete');
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    // Only load enabled/disabled state for simplicity
    const fetch = async () => {
      try {
        const notifStatus = getNotificationStatus();
        setStatus(notifStatus);
        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userRef);
        const userData = userDoc.data();
        setNotificationsEnabled(!!userData?.notificationsEnabled);
        setCurrentDeviceToken(userData?.fcmToken || null);
        
        // Load devices
        await loadDevices();
      } catch (error) {
        console.error('Error loading notification settings:', error);
        setStatus(getNotificationStatus());
      }
    };
    fetch();
  }, [currentUser, loadDevices]);

  // Refresh token state
  const [refreshingToken, setRefreshingToken] = useState(false);

  // Force refresh FCM token and replace all devices
  const handleRefreshToken = async () => {
    if (!currentUser) return;
    setRefreshingToken(true);
    setErrorMsg("");
    try {
      const messaging = getMessaging();
      // Force a new token
      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
      const newToken = await getToken(messaging, { vapidKey, forceRefresh: true });
      if (!newToken) throw new Error('Failed to get new FCM token');
      // Remove all old devices and add new one
      const info = parseDeviceInfo(navigator.userAgent);
      const deviceData = {
        name: deviceName || `${info.os} - ${info.browser}`,
        platform: navigator?.platform || 'web',
        userAgent: navigator?.userAgent || '',
      };
      const ok = await replaceAllDevicesWithToken(currentUser.uid, newToken, deviceData);
      if (!ok) throw new Error('Failed to update device in Firestore');
      setCurrentDeviceToken(newToken);
      setNotificationsEnabled(true);
      await loadDevices();
      setErrorMsg('✅ Notification token refreshed!');
      setTimeout(() => setErrorMsg(''), 4000);
    } catch (e) {
      setErrorMsg('Failed to refresh notification token: ' + (e?.message || e));
    } finally {
      setRefreshingToken(false);
    }
  };

  const handleToggleNotifications = async () => {
    // If enabling, show dialog to name the device
    if (!notificationsEnabled) {
      // Generate a default name suggestion
      const info = parseDeviceInfo(navigator.userAgent);
      const defaultName = `${info.os} - ${info.browser}`;
      setDeviceName(defaultName);
      setEditingDevice(null);
      setDeviceNameDialogOpen(true);
      return;
    }

    // If disabling, just disable
    setLoading(true);
    setErrorMsg("");
    try {
      await disableNotifications(currentUser);
      setNotificationsEnabled(false);
      setStatus(getNotificationStatus());
    } catch (error) {
      setErrorMsg("An error occurred while disabling notifications: " + (error?.message || error));
      console.error('Error disabling notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDeviceName = async () => {
    setLoading(true);
    setErrorMsg("");
    
    try {
      if (editingDevice) {
        // Editing existing device name
        const success = await updateDeviceName(currentUser.uid, editingDevice.token, deviceName.trim());
        if (success) {
          // Update local state
          setDevices(devices.map(d => 
            d.token === editingDevice.token ? { ...d, name: deviceName.trim() } : d
          ));
          setDeviceNameDialogOpen(false);
          setEditingDevice(null);
          setDeviceName('');
        } else {
          setErrorMsg('Failed to update device name');
        }
      } else {
        // Setting up new device
        const token = await setupNotifications(currentUser, deviceName.trim() || null);
        if (token) {
          setNotificationsEnabled(true);
          setCurrentDeviceToken(token);
          setDeviceNameDialogOpen(false);
          setDeviceName('');
          // Reload devices to show the new one
          await loadDevices();
        } else {
          setErrorMsg("Failed to enable notifications. Please check your browser settings, allow notifications, and ensure you are online. If on Android, make sure Chrome is up to date and notifications are allowed for this site.");
          setNotificationsEnabled(false);
        }
      }
      setStatus(getNotificationStatus());
    } catch (error) {
      setErrorMsg("An error occurred: " + (error?.message || error));
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelDeviceName = () => {
    setDeviceNameDialogOpen(false);
    setDeviceName('');
    setEditingDevice(null);
  };

  const handleEditDeviceName = (device) => {
    setEditingDevice(device);
    setDeviceName(device.name || getDeviceName(device));
    setDeviceNameDialogOpen(true);
  };

  const handleToggleDevice = async (deviceToken, currentEnabled) => {
    try {
      const success = await toggleDevice(currentUser.uid, deviceToken, !currentEnabled);
      if (success) {
        // Update local state
        setDevices(devices.map(d => 
          d.token === deviceToken ? { ...d, enabled: !currentEnabled } : d
        ));
      }
    } catch (error) {
      console.error('Error toggling device:', error);
      setErrorMsg('Failed to update device status');
    }
  };

  const handleRemoveDevice = async (deviceToken) => {
    if (!window.confirm('Are you sure you want to remove this device? You will need to re-enable notifications on this device.')) {
      return;
    }

    try {
      const success = await removeDevice(currentUser.uid, deviceToken);
      if (success) {
        // Update local state
        setDevices(devices.filter(d => d.token !== deviceToken));
        
        // If we removed the current device, update the enabled state
        if (deviceToken === currentDeviceToken) {
          setNotificationsEnabled(false);
          setCurrentDeviceToken(null);
        }
      }
    } catch (error) {
      console.error('Error removing device:', error);
      setErrorMsg('Failed to remove device');
    }
  };

  const handleCleanupDuplicates = async () => {
    if (!currentUser) return;

    if (!window.confirm('This will remove duplicate device registrations (same device with multiple tokens). Only the most recent token for each device will be kept. Continue?')) {
      return;
    }

    setLoadingDevices(true);
    setErrorMsg('');

    try {
      console.log('Starting duplicate cleanup for current user...');
      
      // Get all devices
      const userDevices = await getUserDevices(currentUser.uid);
      console.log(`Found ${userDevices.length} devices to analyze`);

      // Group by device fingerprint (userAgent + platform)
      const deviceFingerprintMap = new Map();
      userDevices.forEach(device => {
        const fingerprint = `${device.userAgent || 'unknown'}_${device.platform || 'unknown'}`;
        if (!deviceFingerprintMap.has(fingerprint)) {
          deviceFingerprintMap.set(fingerprint, []);
        }
        deviceFingerprintMap.get(fingerprint).push(device);
      });

      let duplicatesRemoved = 0;

      // Remove duplicates
      for (const [fingerprint, deviceList] of deviceFingerprintMap.entries()) {
        if (deviceList.length > 1) {
          console.log(`Found ${deviceList.length} tokens for same device: ${fingerprint.substring(0, 50)}`);
          
          // Sort by lastSeenAt (keep most recent)
          deviceList.sort((a, b) => {
            const aTime = a.lastSeenAt?.toMillis?.() || a.lastSeenAt?.seconds * 1000 || 0;
            const bTime = b.lastSeenAt?.toMillis?.() || b.lastSeenAt?.seconds * 1000 || 0;
            return bTime - aTime;
          });

          // Keep first (most recent), delete rest
          for (let i = 1; i < deviceList.length; i++) {
            const deviceToRemove = deviceList[i];
            try {
              const success = await removeDevice(currentUser.uid, deviceToRemove.token);
              if (success) {
                duplicatesRemoved++;
                console.log(`Removed old token: ${deviceToRemove.token?.substring(0, 30)}...`);
              }
            } catch (error) {
              console.error(`Failed to remove device: ${error.message}`);
            }
          }
        }
      }

      // Reload devices to show updated list
      await loadDevices();

      if (duplicatesRemoved > 0) {
        setErrorMsg(`✅ Successfully removed ${duplicatesRemoved} duplicate device${duplicatesRemoved > 1 ? 's' : ''}!`);
        setTimeout(() => setErrorMsg(''), 5000);
      } else {
        setErrorMsg('ℹ️ No duplicates found. Your devices are clean!');
        setTimeout(() => setErrorMsg(''), 3000);
      }

      console.log(`Cleanup complete! Removed ${duplicatesRemoved} duplicates`);
    } catch (error) {
      console.error('Error during cleanup:', error);
      setErrorMsg('Failed to cleanup duplicates. Please try again.');
    } finally {
      setLoadingDevices(false);
    }
  };

  const getDeviceIcon = (userAgent) => {
    const info = parseDeviceInfo(userAgent);
    if (info.device === 'Mobile') return <PhoneAndroidIcon />;
    if (info.device === 'Tablet') return <TabletIcon />;
    return <ComputerIcon />;
  };

  // Preferences are not editable in simplified UI

  // Notification type descriptions not needed in simplified UI

  // No extra permission info in simplified UI

  const Content = (
    <>
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

      <Divider sx={{ my: 3 }} />

      {/* Registered Devices Section */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">
          Registered Devices
        </Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Clean up duplicate devices">
            <IconButton onClick={handleCleanupDuplicates} disabled={loadingDevices} size="small" color="warning">
              <DeleteIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Refresh devices">
            <IconButton onClick={loadDevices} disabled={loadingDevices} size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Force refresh notification token (fixes delivery issues)">
            <Button onClick={handleRefreshToken} disabled={refreshingToken || loadingDevices} size="small" variant="outlined" startIcon={<RefreshIcon />}>
              {refreshingToken ? <CircularProgress size={16} /> : 'Refresh Token'}
            </Button>
          </Tooltip>
        </Stack>
      </Box>

      {loadingDevices ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={30} />
        </Box>
      ) : devices.length === 0 ? (
        <Alert severity="info">
          No devices registered for notifications. Enable notifications on this device to get started.
        </Alert>
      ) : (
        <>
          {/* Check for potential duplicates */}
          {(() => {
            const fingerprintMap = new Map();
            devices.forEach(device => {
              const fingerprint = `${device.userAgent || 'unknown'}_${device.platform || 'unknown'}`;
              fingerprintMap.set(fingerprint, (fingerprintMap.get(fingerprint) || 0) + 1);
            });
            const hasDuplicates = Array.from(fingerprintMap.values()).some(count => count > 1);
            
            return hasDuplicates ? (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <strong>Duplicate devices detected!</strong> You have the same device registered with multiple tokens. 
                Click the cleanup button (🗑️) above to remove old tokens.
              </Alert>
            ) : null;
          })()}
          
          <List>
            {devices.map((device, index) => {
              const isCurrentDevice = device.token === currentDeviceToken;
              const deviceName = getDeviceName(device);
            
            return (
              <React.Fragment key={device.token}>
                {index > 0 && <Divider />}
                <ListItem
                  sx={{
                    bgcolor: isCurrentDevice ? 'action.hover' : 'transparent',
                    borderRadius: 1,
                    mb: 0.5
                  }}
                >
                  <Box sx={{ mr: 2, color: 'action.active' }}>
                    {getDeviceIcon(device.userAgent)}
                  </Box>
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body1">
                          {deviceName}
                        </Typography>
                        {isCurrentDevice && (
                          <Chip label="This Device" size="small" color="primary" variant="outlined" />
                        )}
                      </Stack>
                    }
                    secondary={
                      <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          Last active: {formatDeviceDate(device.lastSeenAt)}
                        </Typography>
                        {device.platform && (
                          <Typography variant="caption" color="text.secondary">
                            Platform: {device.platform}
                          </Typography>
                        )}
                      </Stack>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Tooltip title="Edit device name">
                        <IconButton
                          edge="end"
                          onClick={() => handleEditDeviceName(device)}
                          size="small"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={device.enabled ? 'Disable notifications' : 'Enable notifications'}>
                        <Switch
                          edge="end"
                          checked={device.enabled !== false}
                          onChange={() => handleToggleDevice(device.token, device.enabled !== false)}
                          size="small"
                        />
                      </Tooltip>
                      {!isCurrentDevice && (
                        <Tooltip title="Remove device">
                          <IconButton
                            edge="end"
                            onClick={() => handleRemoveDevice(device.token)}
                            size="small"
                            color="error"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  </ListItemSecondaryAction>
                </ListItem>
              </React.Fragment>
            );
          })}
        </List>
        </>
      )}

      {devices.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
          You can enable/disable notifications per device or remove devices you no longer use.
        </Typography>
      )}

      {/* Device Name Dialog */}
      <Dialog open={deviceNameDialogOpen} onClose={handleCancelDeviceName} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingDevice ? 'Edit Device Name' : 'Name This Device'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {editingDevice 
              ? 'Update the name for this device to help you identify it later.'
              : 'Give this device a name to help you identify it later (e.g., "Work Laptop", "Home Desktop", "iPhone").'
            }
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Device Name"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            placeholder="e.g., My Laptop"
            helperText="Leave blank to use auto-generated name"
            disabled={loading}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleConfirmDeviceName();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDeviceName} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmDeviceName} 
            variant="contained" 
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : (editingDevice ? 'Update' : 'Enable Notifications')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );

  if (compact) {
    return Content;
  }

  return (
    <Card>
      <CardContent>
        {Content}
      </CardContent>
    </Card>
  );
};

export default NotificationSettings;