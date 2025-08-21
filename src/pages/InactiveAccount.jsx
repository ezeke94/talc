import React from 'react';
import { Box, Paper, Typography, Button } from '@mui/material';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase/config';
import { useNavigate } from 'react-router-dom';

const InactiveAccount = () => {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (err) {
      console.error('Sign out failed', err);
    }
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', p: 2 }}>
      <Paper sx={{ maxWidth: 680, p: 4 }} elevation={3}>
        <Typography variant="h5" sx={{ mb: 2, fontWeight: 700 }}>Account Inactive</Typography>
        <Typography sx={{ mb: 2 }}>
          Your account is currently inactive. If you believe this is an error, please contact TALC-PHYSIS management to request reactivation.
        </Typography>
        <Typography sx={{ mb: 3, color: 'text.secondary' }}>
          For help, reach out to your center manager or support team. If you need to sign out, use the button below.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="contained" onClick={handleSignOut}>Sign out</Button>
          <Button variant="outlined" onClick={() => window.location.reload()}>Reload</Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default InactiveAccount;
