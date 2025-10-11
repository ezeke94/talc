import React, { useState, useEffect } from 'react';
import { Snackbar, Alert, AlertTitle, Box, Chip, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

/**
 * Debug toast that shows when notifications are received
 * Helps identify duplicate issues and notification flow
 */
export default function NotificationDebugToast() {
  const [debugInfo, setDebugInfo] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Listen for debug events from notification system
    const handleNotificationDebug = (event) => {
      const { detail } = event;
      setDebugInfo(detail);
      setOpen(true);
    };

    window.addEventListener('notification-debug', handleNotificationDebug);

    return () => {
      window.removeEventListener('notification-debug', handleNotificationDebug);
    };
  }, []);

  const handleClose = () => {
    setOpen(false);
  };

  if (!debugInfo) return null;

  const isDuplicate = debugInfo.isDuplicate;
  const source = debugInfo.source || 'unknown';
  const timestamp = new Date(debugInfo.timestamp).toLocaleTimeString();

  return (
    <Snackbar
      open={open}
      autoHideDuration={8000}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      sx={{ mt: 8 }}
    >
      <Alert
        severity={isDuplicate ? 'warning' : 'info'}
        variant="filled"
        onClose={handleClose}
        icon={isDuplicate ? <WarningIcon /> : <NotificationsActiveIcon />}
        sx={{ 
          minWidth: 400,
          maxWidth: 600,
          '& .MuiAlert-message': { width: '100%' }
        }}
      >
        <AlertTitle sx={{ fontWeight: 'bold', mb: 1 }}>
          {isDuplicate ? '⚠️ Duplicate Notification Detected' : '📨 Notification Received'}
        </AlertTitle>
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="body2">
            <strong>Title:</strong> {debugInfo.title}
          </Typography>
          
          <Typography variant="body2" sx={{ opacity: 0.9 }}>
            <strong>Body:</strong> {debugInfo.body?.substring(0, 100)}
            {debugInfo.body?.length > 100 ? '...' : ''}
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
            <Chip
              size="small"
              label={`Source: ${source}`}
              color={source === 'background' ? 'primary' : 'secondary'}
              sx={{ fontWeight: 'bold' }}
            />
            
            <Chip
              size="small"
              label={`Type: ${debugInfo.type || 'general'}`}
              variant="outlined"
            />
            
            <Chip
              size="small"
              label={`Time: ${timestamp}`}
              variant="outlined"
            />
            
            {debugInfo.eventId && (
              <Chip
                size="small"
                label={`Event ID: ${debugInfo.eventId}`}
                variant="outlined"
              />
            )}
          </Box>

          {isDuplicate && debugInfo.previousSource && (
            <Alert severity="error" sx={{ mt: 1, py: 0 }}>
              <Typography variant="caption">
                <strong>Previous:</strong> Shown {debugInfo.timeSince}ms ago from {debugInfo.previousSource}
              </Typography>
            </Alert>
          )}

          {!isDuplicate && (
            <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mt: 1, py: 0 }}>
              <Typography variant="caption">
                <strong>Status:</strong> New notification - displaying now
              </Typography>
            </Alert>
          )}

          {debugInfo.notificationId && (
            <Typography variant="caption" sx={{ mt: 1, opacity: 0.7, fontFamily: 'monospace' }}>
              ID: {debugInfo.notificationId.substring(0, 80)}
              {debugInfo.notificationId.length > 80 ? '...' : ''}
            </Typography>
          )}
        </Box>
      </Alert>
    </Snackbar>
  );
}
