import React, { useState, useEffect } from 'react';
import { IconButton, Badge, Tooltip } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationHistoryDialog from './NotificationHistoryDialog';
import { getUnreadCount } from '../utils/notificationHistory';

const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const updateUnreadCount = () => {
    setUnreadCount(getUnreadCount());
  };

  useEffect(() => {
    // Initial load
    updateUnreadCount();

    // Listen for updates
    const handleUpdate = () => {
      updateUnreadCount();
    };

    window.addEventListener('notification-history-updated', handleUpdate);
    
    // Also update every 5 seconds in case of background notifications
    const interval = setInterval(updateUnreadCount, 5000);

    return () => {
      window.removeEventListener('notification-history-updated', handleUpdate);
      clearInterval(interval);
    };
  }, []);

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton
          color="inherit"
          onClick={() => setOpen(true)}
        >
          <Badge badgeContent={unreadCount} color="error">
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>
      
      <NotificationHistoryDialog 
        open={open} 
        onClose={() => setOpen(false)} 
      />
    </>
  );
};

export default NotificationBell;
