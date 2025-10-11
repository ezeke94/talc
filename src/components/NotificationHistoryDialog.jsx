import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Typography,
  Box,
  Chip,
  Badge,
  Divider
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import EventIcon from '@mui/icons-material/Event';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import AssignmentIcon from '@mui/icons-material/Assignment';
import { useNavigate } from 'react-router-dom';
import {
  getNotificationHistory,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearHistory
} from '../utils/notificationHistory';

const NotificationHistoryDialog = ({ open, onClose }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();

  const loadHistory = () => {
    const history = getNotificationHistory();
    setNotifications(history);
    setUnreadCount(getUnreadCount());
  };

  useEffect(() => {
    if (open) {
      loadHistory();
    }
  }, [open]);

  useEffect(() => {
    // Listen for notification history updates
    const handleUpdate = () => {
      loadHistory();
    };

    window.addEventListener('notification-history-updated', handleUpdate);
    return () => {
      window.removeEventListener('notification-history-updated', handleUpdate);
    };
  }, []);

  const handleNotificationClick = (notification) => {
    // Mark as read
    markAsRead(notification.id);
    loadHistory();

    // Navigate to URL if present
    if (notification.url) {
      onClose();
      navigate(notification.url);
    }
  };

  const handleDelete = (notificationId, event) => {
    event.stopPropagation();
    deleteNotification(notificationId);
    loadHistory();
  };

  const handleMarkAllRead = () => {
    markAllAsRead();
    loadHistory();
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all notification history?')) {
      clearHistory();
      loadHistory();
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'event_reminder':
      case 'event_reminder_owner':
      case 'event_reminder_quality':
      case 'event_create':
      case 'event_update':
        return <EventIcon color="primary" />;
      case 'event_delete':
      case 'event_cancellation':
        return <WarningIcon color="warning" />;
      case 'task_overdue':
        return <AssignmentIcon color="error" />;
      default:
        return <InfoIcon color="action" />;
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    // Less than 1 minute
    if (diff < 60000) {
      return 'Just now';
    }
    // Less than 1 hour
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes}m ago`;
    }
    // Less than 24 hours
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours}h ago`;
    }
    // Less than 7 days
    if (diff < 604800000) {
      const days = Math.floor(diff / 86400000);
      return `${days}d ago`;
    }
    // Older
    return date.toLocaleDateString();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={1}>
            <NotificationsIcon />
            <Typography variant="h6">Notification History</Typography>
            {unreadCount > 0 && (
              <Chip 
                label={unreadCount} 
                color="primary" 
                size="small" 
              />
            )}
          </Box>
          <Box>
            {unreadCount > 0 && (
              <IconButton onClick={handleMarkAllRead} title="Mark all as read" size="small">
                <DoneAllIcon />
              </IconButton>
            )}
            {notifications.length > 0 && (
              <IconButton onClick={handleClearAll} title="Clear all" size="small">
                <DeleteSweepIcon />
              </IconButton>
            )}
          </Box>
        </Box>
      </DialogTitle>
      
      <DialogContent dividers sx={{ p: 0 }}>
        {notifications.length === 0 ? (
          <Box p={4} textAlign="center">
            <NotificationsIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography color="text.secondary">
              No notifications yet
            </Typography>
          </Box>
        ) : (
          <List>
            {notifications.map((notification, index) => (
              <React.Fragment key={notification.id}>
                {index > 0 && <Divider />}
                <ListItem
                  button
                  onClick={() => handleNotificationClick(notification)}
                  sx={{
                    backgroundColor: notification.read ? 'transparent' : 'action.hover',
                    '&:hover': {
                      backgroundColor: notification.read ? 'action.hover' : 'action.selected',
                    }
                  }}
                >
                  <ListItemIcon>
                    {getNotificationIcon(notification.type)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography
                          variant="subtitle2"
                          sx={{
                            fontWeight: notification.read ? 400 : 700,
                            flex: 1
                          }}
                        >
                          {notification.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatTime(notification.timestamp)}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical'
                          }}
                        >
                          {notification.body}
                        </Typography>
                        <Box display="flex" gap={1} mt={0.5}>
                          <Chip 
                            label={notification.source} 
                            size="small" 
                            variant="outlined"
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
                          {!notification.read && (
                            <Chip 
                              label="New" 
                              color="primary" 
                              size="small"
                              sx={{ height: 20, fontSize: '0.7rem' }}
                            />
                          )}
                        </Box>
                      </Box>
                    }
                  />
                  <IconButton
                    edge="end"
                    onClick={(e) => handleDelete(notification.id, e)}
                    size="small"
                  >
                    <DeleteIcon />
                  </IconButton>
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default NotificationHistoryDialog;
