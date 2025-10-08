import React from 'react';
import { Alert } from '@mui/material';

const NotificationPromptSimple = () => {
  return (
    <Alert severity="info" sx={{ mb: 2 }}>
      🔔 Notification system test - If you can see this, the component is loading correctly!
    </Alert>
  );
};

export default NotificationPromptSimple;