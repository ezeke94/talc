import React, { useEffect, useState } from 'react';
import { Box, Button, Paper, Typography, IconButton, Alert, AlertTitle } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import GetAppIcon from '@mui/icons-material/GetApp';
import ShareIcon from '@mui/icons-material/Share';

// Enhanced PWA installation prompt for both Android and iOS
// Supports native install prompt on Android and manual instructions for iOS

const storageKey = 'a2hs-dismissed-v1';

const AddToHomeScreenPrompt = () => {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      if (localStorage.getItem(storageKey)) return;
    } catch (e) {}

    const ua = window.navigator.userAgent || '';
    const iOS = /iP(ad|hone|od)/i.test(ua);
    const android = /Android/i.test(ua);
    const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/i.test(ua);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                        (window.navigator && window.navigator.standalone) === true;

    setIsIOS(iOS);
    setIsAndroid(android);

    // Listen for the beforeinstallprompt event (Android/Chrome)
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!isStandalone) {
        setTimeout(() => setShow(true), 2000);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Show iOS prompt if conditions are met
    if (iOS && isSafari && !isStandalone) {
      setTimeout(() => setShow(true), 2000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Android/Chrome native install
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response to the install prompt: ${outcome}`);
      setDeferredPrompt(null);
      handleDismiss();
    }
  };

  const handleDismiss = () => {
    try { 
      localStorage.setItem(storageKey, '1'); 
    } catch (e) {}
    setShow(false);
  };

  if (!show) return null;

  return (
    <Paper 
      elevation={6} 
      sx={{ 
        position: 'fixed', 
        bottom: 16, 
        left: 16, 
        right: 16, 
        zIndex: 1400, 
        p: 2,
        maxWidth: 'md',
        mx: 'auto'
      }}
    >
      <Alert 
        severity="info"
        action={
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {deferredPrompt ? (
              <Button 
                variant="contained" 
                color="primary" 
                startIcon={<GetAppIcon />}
                onClick={handleInstallClick}
                size="small"
              >
                Install
              </Button>
            ) : (
              <Button 
                variant="contained" 
                color="primary" 
                onClick={handleDismiss}
                size="small"
              >
                Got it
              </Button>
            )}
            <IconButton size="small" onClick={handleDismiss}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        }
        sx={{ alignItems: 'center' }}
      >
        <AlertTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <GetAppIcon />
            Install TALC Management App
          </Box>
        </AlertTitle>
        
        {deferredPrompt ? (
          // Android/Chrome - Native install available
          <Typography variant="body2">
            Install this app on your device for a better experience and push notifications.
          </Typography>
        ) : isIOS ? (
          // iOS Safari - Manual instructions
          <Box>
            <Typography variant="body2" gutterBottom>
              Install this app on your iPhone for a better experience:
            </Typography>
            <Typography variant="body2" component="ol" sx={{ pl: 2, m: 0 }}>
              <li>Tap the <ShareIcon fontSize="small" sx={{ verticalAlign: 'middle' }} /> Share button in Safari</li>
              <li>Scroll down and tap "Add to Home Screen"</li>
              <li>Tap "Add" to install the app</li>
            </Typography>
          </Box>
        ) : isAndroid ? (
          // Android other browsers
          <Box>
            <Typography variant="body2" gutterBottom>
              For the best experience, use Chrome to install this app:
            </Typography>
            <Typography variant="body2">
              Chrome will show an "Install" option in the menu for PWA apps.
            </Typography>
          </Box>
        ) : (
          // Desktop or other
          <Typography variant="body2">
            Add this app to your home screen for quick access and notifications.
          </Typography>
        )}
      </Alert>
    </Paper>
  );
};

export default AddToHomeScreenPrompt;
