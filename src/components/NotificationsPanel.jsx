import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  Badge,
  Box,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Chip,
  Divider,
  Button
} from '@mui/material';
import {
  Event as EventIcon,
  Assessment as KpiIcon,
  Warning as AlertIcon,
  Info as InfoIcon,
  CheckCircle as CompleteIcon,
  Schedule as ReminderIcon,
  Clear as ClearIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { collection, query, where, orderBy, limit, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getNotificationStatus } from '../utils/notifications';

const NotificationsPanel = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    if (!currentUser) return;

    setLoading(true);
    
    // Check notification settings
    const checkNotificationStatus = async () => {
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userRef);
        const userData = userDoc.data();
        const browserStatus = getNotificationStatus();
        
        setNotificationsEnabled(
          userData?.notificationsEnabled && 
          browserStatus.permission === 'granted'
        );
      } catch (error) {
        console.error('Error checking notification status:', error);
      }
    };
    
    checkNotificationStatus();
    
    // Subscribe to user's notifications
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('userId', '==', currentUser.uid),
      orderBy('sentAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notificationsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        sentAt: doc.data().sentAt?.toDate() || new Date()
      }));
      
      setNotifications(notificationsList);
      setUnreadCount(notificationsList.filter(n => !n.read).length);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching notifications:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'event_reminder':
      case 'event_reminder_owner':
      case 'event_reminder_quality':
      case 'event_reminder_owner_same_day':
      case 'event_reschedule':
      case 'event_cancellation':
        return <EventIcon />;
      case 'kpi_reminder':
        return <KpiIcon />;
      case 'task_overdue':
        return <ReminderIcon color="warning" />;
      case 'system_alert':
        return <AlertIcon color="error" />;
      case 'event_completion':
        return <CompleteIcon color="success" />;
      case 'monthly_summary':
        return <InfoIcon color="info" />;
      default:
        return <InfoIcon />;
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'task_overdue':
      case 'system_alert':
        return 'error';
      case 'event_completion':
        return 'success';
      case 'kpi_reminder':
        return 'warning';
      case 'monthly_summary':
        return 'info';
      default:
        return 'default';
    }
  };

  const handleNotificationClick = async (notification) => {
    // Mark as read
    if (!notification.read) {
      try {
        const notificationRef = doc(db, 'notifications', notification.id);
        await updateDoc(notificationRef, { read: true });
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    }

    // Navigate based on type
    switch (notification.type) {
      case 'event_reminder':
      case 'event_reminder_owner':
      case 'event_reminder_quality':
      case 'event_reminder_owner_same_day':
      case 'event_reschedule':
      case 'event_cancellation':
      case 'task_overdue':
        navigate('/calendar');
        break;
      case 'kpi_reminder':
        navigate('/mentors');
        break;
      case 'system_alert':
      case 'monthly_summary':
        navigate('/operational-dashboard');
        break;
      default:
        break;
    }
  };

  const markAllAsRead = async () => {
    const unreadNotifications = notifications.filter(n => !n.read);
    try {
      const promises = unreadNotifications.map(notification => 
        updateDoc(doc(db, 'notifications', notification.id), { read: true })
      );
      await Promise.all(promises);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const formatTimeAgo = (date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="center" p={2}>
            <CircularProgress size={24} />
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            Notifications
            {unreadCount > 0 && (
              <Badge badgeContent={unreadCount} color="error" sx={{ ml: 1 }}>
                <Box component="span" />
              </Badge>
            )}
          </Typography>
          <Box>
            {unreadCount > 0 && (
              <Tooltip title="Mark all as read">
                <IconButton size="small" onClick={markAllAsRead}>
                  <CheckCircle />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        {!notificationsEnabled && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Push notifications are disabled. You may miss important reminders. 
            <Button 
              size="small" 
              onClick={() => navigate('/profile')}
              sx={{ ml: 1 }}
            >
              Enable in Settings
            </Button>
          </Alert>
        )}

        {notifications.length === 0 ? (
          <Alert severity="info">
            No notifications yet. You'll be notified about important events and deadlines.
          </Alert>
        ) : (
          <List dense>
            {notifications.map((notification, index) => (
              <React.Fragment key={notification.id}>
                <ListItem
                  disablePadding
                  sx={{
                    backgroundColor: !notification.read ? 'action.hover' : 'transparent',
                    borderRadius: 1,
                    mb: 0.5
                  }}
                >
                  <ListItemButton onClick={() => handleNotificationClick(notification)}>
                    <ListItemIcon>
                      {getNotificationIcon(notification.type)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              fontWeight: !notification.read ? 'bold' : 'normal',
                              flex: 1
                            }}
                          >
                            {notification.message}
                          </Typography>
                          <Chip
                            size="small"
                            label={notification.type.replace(/_/g, ' ')}
                            color={getNotificationColor(notification.type)}
                            variant="outlined"
                          />
                        </Box>
                      }
                      secondary={formatTimeAgo(notification.sentAt)}
                    />
                  </ListItemButton>
                </ListItem>
                {index < notifications.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
};

export default NotificationsPanel;