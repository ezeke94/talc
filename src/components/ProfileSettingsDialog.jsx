import React, { useEffect, useState } from 'react';
import { Box, Button, TextField, FormControl, InputLabel, Select, MenuItem, Chip, OutlinedInput, Typography, Divider, Switch, FormControlLabel, Alert, AlertTitle } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import { doc, getDoc, updateDoc, collection, onSnapshot } from 'firebase/firestore';
import { setupNotifications, disableNotifications, getNotificationStatus } from '../utils/notifications';

const ProfileSettingsDialog = ({ onClose }) => {
  const { currentUser } = useAuth();
  const [userData, setUserData] = useState(null);
  const [name, setName] = useState('');
  const [assignedCenter, setAssignedCenter] = useState('');
  const [centers, setCenters] = useState([]);
  
  // Notification settings state
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState(() => {
    try {
      return getNotificationStatus();
    } catch (error) {
      return { supported: false, permission: 'default', messagingSupported: false };
    }
  });

  useEffect(() => {
    if (!currentUser) return;
    
    const loadData = async () => {
      // Load user profile data
      const ref = doc(db, 'users', currentUser.uid);
      const snap = await getDoc(ref);
      const data = snap.exists() ? snap.data() : null;
      
      setUserData(data);
      setName(data?.name || data?.displayName || '');
      setNotificationsEnabled(!!data?.notificationsEnabled);
      
      if (Array.isArray(data?.assignedCenters)) {
        setAssignedCenter(data.assignedCenters[0] || '');
      } else {
        setAssignedCenter(data?.assignedCenters || '');
      }
      
      // Update notification status
      const status = getNotificationStatus();
      setNotificationStatus(status);
    };
    
    loadData();
    
    const unsub = onSnapshot(collection(db, 'centers'), (snap) => {
      setCenters(snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) })));
    });
    return () => unsub();
  }, [currentUser]);

  const save = async () => {
    if (!currentUser) return;
    await updateDoc(doc(db, 'users', currentUser.uid), {
      name,
      assignedCenters: assignedCenter ? [assignedCenter] : [],
    });
    onClose?.();
  };

  const handleToggleNotifications = async () => {
    setLoading(true);
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
        }
      }
      
      // Refresh status
      const status = getNotificationStatus();
      setNotificationStatus(status);
    } catch (error) {
      console.error('Error toggling notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1, maxHeight: '70vh', overflowY: 'auto' }}>
      {/* Profile Information */}
      <Typography variant="h6" gutterBottom>
        Profile Information
      </Typography>
      
      <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
      <FormControl fullWidth size="small">
        <InputLabel id="center-select-label">Assigned Center</InputLabel>
        <Select
          labelId="center-select-label"
          value={assignedCenter}
          onChange={e => setAssignedCenter(e.target.value)}
          input={<OutlinedInput label="Assigned Center" />}
        >
          {centers.map(c => (
            <MenuItem key={c.id || c.name} value={c.id || c.name}>{c.name || c.id}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <Divider sx={{ my: 2 }} />

      {/* Notification Settings */}
      <Typography variant="h6" gutterBottom>
        Notification Settings
      </Typography>
      
      {notificationStatus.supported && notificationStatus.permission === 'denied' && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <AlertTitle>Notifications Blocked</AlertTitle>
          Click the lock icon (🔒) in your browser's address bar and allow notifications, then refresh this page.
        </Alert>
      )}
      
      {notificationStatus.supported && notificationStatus.permission === 'default' && !notificationsEnabled && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <AlertTitle>Enable Push Notifications</AlertTitle>
          Get important reminders about events, KPI deadlines, and system updates.
        </Alert>
      )}

      {!notificationsEnabled && notificationStatus.supported && notificationStatus.permission !== 'denied' && (
        <Box sx={{ mb: 2, textAlign: 'center' }}>
          <Button
            variant="contained"
            startIcon={<NotificationsIcon />}
            onClick={handleToggleNotifications}
            disabled={loading}
            sx={{ 
              py: 1.2, 
              px: 3,
              fontSize: '1rem',
              fontWeight: 600,
              background: 'linear-gradient(45deg, #7BC678 30%, #5BA055 90%)',
              '&:hover': {
                background: 'linear-gradient(45deg, #5BA055 30%, #7BC678 90%)',
              }
            }}
          >
            {loading ? 'Enabling...' : 'Allow Notifications'}
          </Button>
        </Box>
      )}
      
      <FormControlLabel
        control={
          <Switch
            checked={notificationsEnabled}
            onChange={handleToggleNotifications}
            disabled={loading || !notificationStatus.supported || notificationStatus.permission === 'denied'}
          />
        }
        label="Push Notifications Enabled"
      />
      
      {notificationsEnabled && (
        <Alert severity="success" sx={{ mb: 1 }}>
          ✅ Notifications are enabled! You'll receive important reminders and updates.
        </Alert>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 3 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={!name}>Save</Button>
      </Box>
    </Box>
  );
};

export default ProfileSettingsDialog;
