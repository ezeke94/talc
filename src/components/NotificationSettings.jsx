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
import { doc, updateDoc, getDoc } from 'firebase/firestore';
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
  updateDeviceName
} from '../utils/deviceManager';

const NotificationSettings = () => {
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
          setCurrentDeviceToken(userData?.fcmToken || null);
          
          // Load devices
          await loadDevices();
        } catch (error) {
          console.error('Error loading notification settings:', error);
          setStatus(getNotificationStatus());
        }
      };
      fetch();
    }
  }, [currentUser]);

  const loadDevices = async () => {
    if (!currentUser) return;
    
    setLoadingDevices(true);
    try {
      const userDevices = await getUserDevices(currentUser.uid);
      setDevices(userDevices);
    } catch (error) {
      console.error('Error loading devices:', error);
    } finally {
      setLoadingDevices(false);
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

  const getDeviceIcon = (userAgent) => {
    const info = parseDeviceInfo(userAgent);
    if (info.device === 'Mobile') return <PhoneAndroidIcon />;
    if (info.device === 'Tablet') return <TabletIcon />;
    return <ComputerIcon />;
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

        <Divider sx={{ my: 3 }} />

        {/* Registered Devices Section */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">
            Registered Devices
          </Typography>
          <Tooltip title="Refresh devices">
            <IconButton onClick={loadDevices} disabled={loadingDevices} size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
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
        )}

        {devices.length > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            You can enable/disable notifications per device or remove devices you no longer use.
          </Typography>
        )}
      </CardContent>

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
    </Card>
  );
};

export default NotificationSettings;