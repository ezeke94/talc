import React, { useEffect, useMemo, useState } from 'react';
import {
  Container,
  Typography,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  CircularProgress,
  Box,
  Chip,
  OutlinedInput,
  useTheme,
  useMediaQuery,
  Card,
  CardContent,
  CardActions,
  Stack,
  Grid,
  IconButton,
  Tooltip,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
} from '@mui/material';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import LaptopIcon from '@mui/icons-material/Laptop';
import DevicesIcon from '@mui/icons-material/Devices';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { db } from '../firebase/config';
import { collection, onSnapshot, updateDoc, doc, getDoc, getDocs } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { getFunctions, httpsCallable } from 'firebase/functions';

const ROLES = ['Evaluator', 'Admin', 'Quality', 'Management', 'Coordinator'];

const UserManagement = () => {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [centers, setCenters] = useState([]);
  const [activeLoading, setActiveLoading] = useState({}); // Track loading per user
  const [testNotifLoading, setTestNotifLoading] = useState({});
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [deviceDialog, setDeviceDialog] = useState({ open: false, userId: null, userName: '', devices: [] });
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));

  // Only admin/quality can manage users in production; allow all authenticated in non-production
  const canManage = (import.meta.env.MODE !== 'production') || (currentUser && ['Admin', 'Quality'].includes(currentUser.role));

  useEffect(() => {
    setLoading(true);
    setError('');
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      // Ensure isActive is false for new users if not set
      setUsers(snapshot.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          isActive: typeof data.isActive === 'boolean' ? data.isActive : false
        };
      }));
      setLoading(false);
    }, (e) => {
      console.error('Failed to subscribe to users', e);
      setError('Failed to load users');
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Subscribe to centers for assignment UI
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'centers'), (snap) => {
      setCenters(snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) })));
    }, (e) => console.error('Failed to load centers', e));
    return () => unsub();
  }, []);

  const centerOptions = useMemo(() => centers.map(c => ({ value: c.id || c.name, label: c.name || c.id })), [centers]);

  const filteredSortedUsers = useMemo(() => {
    const term = (q || '').toLowerCase();
    // Filter and deduplicate users by email
    const seenEmails = new Set();
    const arr = users.filter(u => {
      const n = (u.name || u.displayName || '').toLowerCase();
      const e = (u.email || '').toLowerCase();
      if (seenEmails.has(e)) return false;
      seenEmails.add(e);
      return !term || n.includes(term) || e.includes(term);
    });
    return arr.sort((a, b) => {
      const an = (a.name || a.displayName || a.email || '').toLowerCase();
      const bn = (b.name || b.displayName || b.email || '').toLowerCase();
      return an.localeCompare(bn);
    });
  }, [users, q]);

  const handleRoleChange = async (userId, newRole) => {
  await updateDoc(doc(db, 'users', userId), { role: newRole });
  };

  const handleActiveChange = (userId, isActive) => {
    setActiveLoading(prev => ({ ...prev, [userId]: true }));
    updateDoc(doc(db, 'users', userId), { isActive })
      .catch(() => {})
      .finally(() => {
        setActiveLoading(prev => ({ ...prev, [userId]: false }));
      });
  };

  const handleOpenDeviceDialog = async (userId, userName) => {
    try {
      // Fetch user's devices
      const devices = [];
      
      // Get from devices subcollection
      const devicesRef = collection(db, 'users', userId, 'devices');
      const devicesSnap = await getDocs(devicesRef);
      
      devicesSnap.forEach(deviceDoc => {
        const deviceData = deviceDoc.data();
        devices.push({
          token: deviceDoc.id,
          enabled: deviceData?.enabled !== false,
          deviceType: deviceData?.deviceType || 'Unknown',
          browser: deviceData?.browser || 'Unknown',
          os: deviceData?.os || 'Unknown',
          registeredAt: deviceData?.registeredAt?.toDate?.() || deviceData?.registeredAt || new Date(),
          lastUsed: deviceData?.lastUsed?.toDate?.() || deviceData?.lastUsed || new Date()
        });
      });

      // Also check for legacy fcmToken
      const userDoc = await getDoc(doc(db, 'users', userId));
      const userData = userDoc.data();
      if (userData?.fcmToken && devices.length === 0) {
        devices.push({
          token: userData.fcmToken,
          enabled: true,
          deviceType: 'Legacy',
          browser: 'Unknown',
          os: 'Unknown',
          registeredAt: new Date(),
          lastUsed: new Date()
        });
      }

      setDeviceDialog({ open: true, userId, userName, devices });
    } catch (err) {
      console.error('Error fetching devices:', err);
      setSnackbar({ open: true, message: 'Error fetching devices', severity: 'error' });
    }
  };

  const handleCloseDeviceDialog = () => {
    setDeviceDialog({ open: false, userId: null, userName: '', devices: [] });
  };

  const handleSendTestNotification = async () => {
    const { userId, userName } = deviceDialog;
    
    if (!userId) return;
    
    setTestNotifLoading(prev => ({ ...prev, [userId]: true }));
    handleCloseDeviceDialog();
    
    try {
      // Call Firebase callable function
      const functions = getFunctions();
      const sendTestNotif = httpsCallable(functions, 'sendTestNotification');
      
      const result = await sendTestNotif({ userId, userName });
      
      if (result.data.success) {
        setSnackbar({ 
          open: true, 
          message: `Test notification sent to ${result.data.totalSent} device(s) successfully!`, 
          severity: 'success' 
        });
      } else {
        setSnackbar({ open: true, message: 'Failed to send notification', severity: 'error' });
      }
    } catch (err) {
      console.error('Error sending test notification:', err);
      setSnackbar({ 
        open: true, 
        message: err.message || 'Error sending test notification', 
        severity: 'error' 
      });
    } finally {
      setTestNotifLoading(prev => ({ ...prev, [userId]: false }));
    }
  };

  const getDeviceIcon = (deviceType, os) => {
    const osLower = (os || '').toLowerCase();
    const typeLower = (deviceType || '').toLowerCase();
    
    if (osLower.includes('ios') || osLower.includes('iphone') || osLower.includes('ipad')) {
      return <PhoneIphoneIcon />;
    } else if (osLower.includes('android')) {
      return <PhoneAndroidIcon />;
    } else if (typeLower.includes('mobile')) {
      return <PhoneAndroidIcon />;
    } else if (typeLower.includes('desktop') || typeLower.includes('laptop')) {
      return <LaptopIcon />;
    }
    return <DevicesIcon />;
  };

  return (
    <Container maxWidth="lg">
      <Paper sx={{ p: 4, mt: 6 }}>
        <Typography variant="h4" gutterBottom>User Management</Typography>
        <Typography variant="body1" paragraph>
          Admins and Quality team can assign roles, activate/deactivate users, and manage center assignments.
        </Typography>
        <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
          <TextField size="small" label="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} sx={{ maxWidth: 320 }} />
        </Box>
        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={20} />
            <Typography>Loading users...</Typography>
          </Box>
        ) : error ? (
          <Typography color="error">{error}</Typography>
        ) : isSmall ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {filteredSortedUsers.map(user => (
              <Card key={user.id} variant="outlined" sx={{ boxShadow: 3, borderRadius: 3, bgcolor: 'grey.50', p: 2 }}>
                <CardContent>
                  <Stack spacing={2}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
                        {user.name || user.displayName || user.email || '-'}
                      </Typography>
                      {canManage && (
                        <Tooltip title="View Devices & Send Test Notification">
                          <IconButton 
                            color="primary" 
                            size="small"
                            onClick={() => handleOpenDeviceDialog(user.id, user.name || user.displayName || user.email)}
                            disabled={testNotifLoading[user.id]}
                          >
                            {testNotifLoading[user.id] ? (
                              <CircularProgress size={20} />
                            ) : (
                              <NotificationsActiveIcon />
                            )}
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                    <Typography variant="body2" color="text.secondary">{user.email || '-'}</Typography>

                    <FormControl fullWidth size="medium">
                      <InputLabel>Role</InputLabel>
                      {canManage ? (
                        <Select
                          value={ROLES.includes(user.role) ? user.role : ''}
                          label="Role"
                          onChange={e => handleRoleChange(user.id, e.target.value)}
                        >
                          {ROLES.map(role => (
                            <MenuItem key={role} value={role}>{role}</MenuItem>
                          ))}
                        </Select>
                      ) : (
                        <Box sx={{ py: 1 }}>{ROLES.includes(user.role) ? user.role : '-'}</Box>
                      )}
                    </FormControl>

                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mt: 1 }}>
                      <Typography variant="body2">Status:</Typography>
                      {canManage ? (
                        <ToggleButtonGroup
                          value={user.isActive ? 'active' : 'inactive'}
                          exclusive
                          onChange={(e, val) => {
                            if (val !== null) handleActiveChange(user.id, val === 'active');
                          }}
                          size="medium"
                          disabled={Boolean(activeLoading[user.id])}
                        >
                          <ToggleButton value="active" color="success" sx={{ px: 3 }}>Active</ToggleButton>
                          <ToggleButton value="inactive" color="error" sx={{ px: 3 }}>Inactive</ToggleButton>
                        </ToggleButtonGroup>
                      ) : (user.isActive ? <Chip label="Active" color="success" /> : <Chip label="Inactive" color="error" />)}
                    </Box>

                    <FormControl fullWidth size="medium" sx={{ mt: 1 }}>
                      <InputLabel>Center</InputLabel>
                      {canManage ? (
                        <Select
                          value={Array.isArray(user.assignedCenters) ? user.assignedCenters[0] || '' : (user.assignedCenters || '')}
                          onChange={async (e) => {
                            const newVal = e.target.value;
                            await updateDoc(doc(db, 'users', user.id), { assignedCenters: newVal ? [newVal] : [] });
                          }}
                          input={<OutlinedInput label="Center" />}
                        >
                          {centerOptions.map(opt => (
                            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                          ))}
                        </Select>
                      ) : (
                        <Box sx={{ py: 1 }}>{Array.isArray(user.assignedCenters) && user.assignedCenters.length > 0
                          ? (centerOptions.find(c => c.value === user.assignedCenters[0])?.label || user.assignedCenters[0])
                          : '-'}</Box>
                      )}
                    </FormControl>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Box>
        ) : (
          <Table size="small" sx={{ bgcolor: 'background.paper', borderRadius: 2, boxShadow: 1 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.100' }}>
                <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Role</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Centers</TableCell>
                {canManage && <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredSortedUsers.map(user => (
                <TableRow key={user.id} hover>
                  <TableCell>{user.name || user.displayName || user.email || '-'}</TableCell>
                  <TableCell>{user.email || '-'}</TableCell>
                  <TableCell>
                    {canManage ? (
                      <FormControl size="small">
                        <InputLabel>Role</InputLabel>
                        <Select
                          value={ROLES.includes(user.role) ? user.role : ''}
                          label="Role"
                          onChange={e => handleRoleChange(user.id, e.target.value)}
                        >
                          {ROLES.map(role => (
                            <MenuItem key={role} value={role}>{role}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    ) : (ROLES.includes(user.role) ? user.role : '-')}
                  </TableCell>
                  <TableCell>
                    {canManage ? (
                      <ToggleButtonGroup
                        value={user.isActive ? 'active' : 'inactive'}
                        exclusive
                        onChange={(e, val) => {
                          if (val !== null) handleActiveChange(user.id, val === 'active');
                        }}
                        size="small"
                        disabled={Boolean(activeLoading[user.id])}
                      >
                        <ToggleButton value="active" color="success" sx={{ px: 2, fontSize: '0.95rem' }}>Active</ToggleButton>
                        <ToggleButton value="inactive" color="error" sx={{ px: 2, fontSize: '0.95rem' }}>Inactive</ToggleButton>
                      </ToggleButtonGroup>
                    ) : (user.isActive ? <Chip label="Active" color="success" size="small" /> : <Chip label="Inactive" color="error" size="small" />)}
                  </TableCell>
                  <TableCell>
                    {canManage ? (
                      <FormControl size="small" sx={{ minWidth: 180 }}>
                        <InputLabel>Center</InputLabel>
                        <Select
                          value={Array.isArray(user.assignedCenters) ? user.assignedCenters[0] || '' : (user.assignedCenters || '')}
                          onChange={async (e) => {
                            const newVal = e.target.value;
                            await updateDoc(doc(db, 'users', user.id), { assignedCenters: newVal ? [newVal] : [] });
                          }}
                          input={<OutlinedInput label="Center" />}
                        >
                          {centerOptions.map(opt => (
                            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    ) : (Array.isArray(user.assignedCenters) && user.assignedCenters.length > 0
                          ? (centerOptions.find(c => c.value === user.assignedCenters[0])?.label || user.assignedCenters[0])
                          : '-')}
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <Tooltip title="View Devices & Send Test Notification">
                        <IconButton 
                          color="primary" 
                          size="small"
                          onClick={() => handleOpenDeviceDialog(user.id, user.name || user.displayName || user.email)}
                          disabled={testNotifLoading[user.id]}
                        >
                          {testNotifLoading[user.id] ? (
                            <CircularProgress size={20} />
                          ) : (
                            <NotificationsActiveIcon />
                          )}
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>
      
      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={4000} 
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Device Dialog */}
      <Dialog 
        open={deviceDialog.open} 
        onClose={handleCloseDeviceDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Devices for {deviceDialog.userName}
        </DialogTitle>
        <DialogContent>
          {deviceDialog.devices.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              No devices registered for this user.
            </Typography>
          ) : (
            <List>
              {deviceDialog.devices.map((device, index) => (
                <React.Fragment key={device.token}>
                  {index > 0 && <Divider />}
                  <ListItem>
                    <ListItemIcon>
                      {getDeviceIcon(device.deviceType, device.os)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body1">
                            {device.deviceType} - {device.os}
                          </Typography>
                          {device.enabled ? (
                            <CheckCircleIcon color="success" fontSize="small" />
                          ) : (
                            <CancelIcon color="error" fontSize="small" />
                          )}
                        </Box>
                      }
                      secondary={
                        <>
                          <Typography variant="caption" display="block">
                            Browser: {device.browser}
                          </Typography>
                          <Typography variant="caption" display="block">
                            Status: {device.enabled ? 'Enabled' : 'Disabled'}
                          </Typography>
                          <Typography variant="caption" display="block">
                            Last Used: {device.lastUsed?.toLocaleString?.() || 'Unknown'}
                          </Typography>
                        </>
                      }
                    />
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeviceDialog}>Cancel</Button>
          <Button 
            onClick={handleSendTestNotification} 
            variant="contained" 
            disabled={deviceDialog.devices.length === 0}
          >
            Send Test Notification
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default UserManagement;
