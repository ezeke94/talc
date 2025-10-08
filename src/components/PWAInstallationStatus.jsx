import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Alert,
  AlertTitle,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Divider
} from '@mui/material';
import {
  GetApp as InstallIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Smartphone as MobileIcon,
  Computer as DesktopIcon,
  Notifications as NotificationsIcon,
  Home as HomeIcon
} from '@mui/icons-material';
import { getInstallationStatus } from '../utils/pwaUtils';

const PWAInstallationStatus = () => {
  const [installStatus, setInstallStatus] = useState(() => {
    // Initialize status immediately to prevent null state
    try {
      return getInstallationStatus();
    } catch (error) {
      console.error('Error getting initial installation status:', error);
      return {
        isPWA: false,
        isIOS: false,
        isAndroid: false,
        isMobile: false,
        canInstall: false,
        isStandalone: false
      };
    }
  });
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    // Set status immediately
    const status = getInstallationStatus();
    setInstallStatus(status);

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response to install prompt: ${outcome}`);
      setDeferredPrompt(null);
      
      // Update status after installation attempt
      setTimeout(() => {
        setInstallStatus(getInstallationStatus());
      }, 1000);
    }
  };

  const { isPWA, isIOS, isAndroid, isMobile, canInstall, isStandalone } = installStatus;

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          App Installation Status
        </Typography>

        {/* Current Status */}
        <Box sx={{ mb: 3 }}>
          {isStandalone ? (
            <Alert severity="success" sx={{ mb: 2 }}>
              <AlertTitle>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckIcon />
                  App Installed Successfully
                </Box>
              </AlertTitle>
              TALC Management is installed and running as a standalone app! You can access it from your home screen.
            </Alert>
          ) : (
            <Alert severity="info" sx={{ mb: 2 }}>
              <AlertTitle>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <InstallIcon />
                  Install Available
                </Box>
              </AlertTitle>
              Install TALC Management as an app for better performance and offline access.
            </Alert>
          )}
        </Box>

        {/* Device Information */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Device Information
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon>
                {isMobile ? <MobileIcon /> : <DesktopIcon />}
              </ListItemIcon>
              <ListItemText 
                primary={`Device Type: ${isMobile ? 'Mobile' : 'Desktop'}`}
                secondary={isIOS ? 'iOS Device' : isAndroid ? 'Android Device' : 'Other'}
              />
              <Chip 
                label={isIOS ? 'iOS' : isAndroid ? 'Android' : 'Desktop'} 
                size="small" 
                color={isMobile ? 'primary' : 'default'}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <HomeIcon />
              </ListItemIcon>
              <ListItemText 
                primary="Installation Status"
                secondary={isStandalone ? 'Installed as app' : 'Running in browser'}
              />
              <Chip 
                label={isStandalone ? 'Installed' : 'Browser'} 
                size="small" 
                color={isStandalone ? 'success' : 'default'}
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <NotificationsIcon />
              </ListItemIcon>
              <ListItemText 
                primary="Notification Support"
                secondary={canInstall ? 'Supported' : 'Limited support'}
              />
              <Chip 
                label={canInstall ? 'Supported' : 'Limited'} 
                size="small" 
                color={canInstall ? 'success' : 'warning'}
              />
            </ListItem>
          </List>
        </Box>

        {/* Installation Instructions */}
        {!isStandalone && (
          <Box>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="subtitle2" gutterBottom>
              Installation Instructions
            </Typography>
            
            {deferredPrompt ? (
              // Native install prompt available (Android Chrome)
              <Box sx={{ textAlign: 'center', mb: 2 }}>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<InstallIcon />}
                  onClick={handleInstall}
                  sx={{ 
                    py: 1.5, 
                    px: 4,
                    background: 'linear-gradient(45deg, #7BC678 30%, #5BA055 90%)',
                  }}
                >
                  Install App Now
                </Button>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Click to install TALC Management as a native app
                </Typography>
              </Box>
            ) : isIOS ? (
              // iOS Safari instructions
              <Alert severity="info">
                <AlertTitle>iOS Installation</AlertTitle>
                <Typography variant="body2" component="ol" sx={{ pl: 2, m: 0 }}>
                  <li>Tap the Share button (⬆️) in Safari</li>
                  <li>Scroll down and tap "Add to Home Screen"</li>
                  <li>Tap "Add" to install the app</li>
                  <li>The app will appear on your home screen</li>
                </Typography>
              </Alert>
            ) : isAndroid ? (
              // Android other browsers
              <Alert severity="info">
                <AlertTitle>Android Installation</AlertTitle>
                <Typography variant="body2" gutterBottom>
                  For the best experience, use Chrome browser:
                </Typography>
                <Typography variant="body2" component="ol" sx={{ pl: 2, m: 0 }}>
                  <li>Open this site in Chrome</li>
                  <li>Tap the menu (⋮) in Chrome</li>
                  <li>Look for "Install app" or "Add to Home screen"</li>
                  <li>Follow the prompts to install</li>
                </Typography>
              </Alert>
            ) : (
              // Desktop instructions
              <Alert severity="info">
                <AlertTitle>Desktop Installation</AlertTitle>
                <Typography variant="body2" component="ol" sx={{ pl: 2, m: 0 }}>
                  <li>Look for an install icon (⬇️) in your browser's address bar</li>
                  <li>Or check your browser's menu for "Install" option</li>
                  <li>Chrome and Edge support PWA installation on desktop</li>
                </Typography>
              </Alert>
            )}
          </Box>
        )}

        {/* Benefits */}
        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Benefits of Installing the App
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon><CheckIcon color="success" /></ListItemIcon>
              <ListItemText primary="Faster loading and better performance" />
            </ListItem>
            <ListItem>
              <ListItemIcon><CheckIcon color="success" /></ListItemIcon>
              <ListItemText primary="Works offline with cached data" />
            </ListItem>
            <ListItem>
              <ListItemIcon><CheckIcon color="success" /></ListItemIcon>
              <ListItemText primary="Push notifications for important updates" />
            </ListItem>
            <ListItem>
              <ListItemIcon><CheckIcon color="success" /></ListItemIcon>
              <ListItemText primary="Home screen icon for quick access" />
            </ListItem>
            <ListItem>
              <ListItemIcon><CheckIcon color="success" /></ListItemIcon>
              <ListItemText primary="Native app-like experience" />
            </ListItem>
          </List>
        </Box>
      </CardContent>
    </Card>
  );
};

export default PWAInstallationStatus;