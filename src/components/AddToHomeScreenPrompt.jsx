import React, { useEffect, useState } from 'react';
import { Box, Button, Paper, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

// Simple iOS Add to Home Screen hint for Safari mobile users.
// Shows a small dismissible hint that explains how to add to home screen.

const storageKey = 'a2hs-dismissed-v1';

const AddToHomeScreenPrompt = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (localStorage.getItem(storageKey)) return;
    } catch (e) {}

    const ua = window.navigator.userAgent || '';
    const isIOS = /iP(ad|hone|od)/i.test(ua);
    const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/i.test(ua);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator && window.navigator.standalone) === true;

    if (isIOS && isSafari && !isStandalone) {
      // show after slight delay to avoid jank
      setTimeout(() => setShow(true), 1000);
    }
  }, []);

  if (!show) return null;

  return (
    <Paper elevation={6} sx={{ position: 'fixed', bottom: 16, left: 16, right: 16, zIndex: 1400, p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box sx={{ flex: 1 }}>
        <Typography variant="body1" sx={{ fontWeight: 600 }}>Add TALC Management to your Home Screen</Typography>
        <Typography variant="body2">Tap the share button (the square with an arrow), then "Add to Home Screen" to enable push notifications on iOS.</Typography>
      </Box>
      <Button variant="contained" color="primary" onClick={() => { try { localStorage.setItem(storageKey, '1'); } catch (e) {} setShow(false); }}>Got it</Button>
      <IconButton size="small" onClick={() => { try { localStorage.setItem(storageKey, '1'); } catch (e) {} setShow(false); }}><CloseIcon /></IconButton>
    </Paper>
  );
};

export default AddToHomeScreenPrompt;
