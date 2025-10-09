import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import './index.css';
import { initializePWAHandlers } from './utils/pwaUtils.js';

// Initialize PWA handlers early
initializePWAHandlers();

const ensureFirebaseMessagingServiceWorker = () => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return;
  }

  const registerIfNeeded = async () => {
    try {
      const existing = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
      if (!existing) {
        await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        console.log('Firebase messaging service worker registered proactively');
      }
    } catch (err) {
      console.warn('Unable to register firebase messaging service worker upfront:', err);
    }
  };

  if (document.readyState === 'complete') {
    registerIfNeeded();
  } else {
    window.addEventListener('load', registerIfNeeded, { once: true });
  }
};

ensureFirebaseMessagingServiceWorker();

const theme = createTheme({
  palette: {
    mode: 'light',
    // Reference palette from design: 292D34 (charcoal), FE7648 (orange), 7BC678 (green), DDEEDD (mint)
    primary: {
      main: '#7BC678',
      light: '#A9E3A6',
      dark: '#4F9B4E',
      contrastText: '#292D34',
    },
    secondary: {
      main: '#FE7648',
      light: '#FFA684',
      dark: '#C84F25',
      contrastText: '#292D34',
    },
    success: {
      main: '#7BC678',
      dark: '#4F9B4E',
    },
    warning: {
      main: '#FE7648',
      dark: '#C84F25',
    },
    background: {
      default: '#DDEEDD',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#292D34',
      secondary: '#4A5059',
    },
    divider: 'rgba(41,45,52,0.12)'
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    // Enhanced mobile typography
    h4: {
      fontWeight: 700,
      fontSize: '1.5rem',
      '@media (min-width:600px)': {
        fontSize: '1.75rem',
      },
      '@media (min-width:960px)': {
        fontSize: '2rem',
      },
    },
    h5: {
      fontWeight: 600,
      fontSize: '1.125rem',
      '@media (min-width:600px)': {
        fontSize: '1.25rem',
      },
      '@media (min-width:960px)': {
        fontSize: '1.5rem',
      },
    },
    h6: {
      fontWeight: 600,
      fontSize: '1rem',
      '@media (min-width:600px)': {
        fontSize: '1.125rem',
      },
    },
    body1: {
      fontSize: '0.875rem',
      '@media (min-width:600px)': {
        fontSize: '1rem',
      },
    },
    body2: {
      fontSize: '0.75rem',
      '@media (min-width:600px)': {
        fontSize: '0.875rem',
      },
    },
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 900,
      lg: 1200,
      xl: 1536,
    },
  },
  components: {
    // Enhanced mobile touch targets
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600,
          padding: '12px 20px', // Larger touch targets for mobile
          minHeight: '44px', // iOS/Android recommended minimum
          '@media (max-width:600px)': {
            padding: '14px 24px',
            minHeight: '48px',
            fontSize: '1rem',
          },
        },
        contained: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          },
        },
        fab: {
          width: 56,
          height: 56,
          '@media (max-width:600px)': {
            width: 64,
            height: 64,
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          padding: '12px',
          '@media (max-width:600px)': {
            padding: '16px',
            '& .MuiSvgIcon-root': {
              fontSize: '1.5rem',
            },
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '@media (max-width:600px)': {
            '& .MuiInputBase-root': {
              minHeight: '48px',
            },
            '& .MuiInputBase-input': {
              fontSize: '16px', // Prevents zoom on iOS
            },
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          '@media (max-width:600px)': {
            minHeight: '48px',
            '& .MuiSelect-select': {
              fontSize: '16px', // Prevents zoom on iOS
            },
          },
        },
      },
    },
    MuiFab: {
      styleOverrides: {
        root: {
          boxShadow: '0 4px 20px rgba(123,198,120,0.4)',
          '&:hover': {
            boxShadow: '0 6px 24px rgba(123,198,120,0.5)',
          },
          '@media (max-width:600px)': {
            width: 64,
            height: 64,
            fontSize: '1.5rem',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 16px rgba(41,45,52,0.06)',
          '@media (max-width:600px)': {
            borderRadius: 8,
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 16px rgba(41,45,52,0.06)',
          '@media (max-width:600px)': {
            borderRadius: 8,
            margin: '8px',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0 4px 24px rgba(123,198,120,0.25)',
          '@media (max-width:600px)': {
            '& .MuiToolbar-root': {
              minHeight: 64,
              paddingLeft: 16,
              paddingRight: 16,
            },
          },
        }
      }
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          '@media (max-width:600px)': {
            margin: 16,
            maxWidth: 'calc(100vw - 32px)',
            borderRadius: 12,
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          '@media (max-width:600px)': {
            padding: '8px 4px',
            fontSize: '0.75rem',
          },
        },
      },
    },
    // Enhanced touch feedback
    MuiTouchRipple: {
      styleOverrides: {
        root: {
          color: 'rgba(123,198,120,0.3)',
        },
      },
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);

// Remove PWA service worker: always unregister any existing service workers and clear app caches.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations?.().then(regs => {
    regs.forEach(reg => {
      const scriptUrl = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL;
      let isFirebaseMessagingSw = false;

      if (scriptUrl) {
        try {
          const swPath = new URL(scriptUrl).pathname;
          isFirebaseMessagingSw = swPath.endsWith('/firebase-messaging-sw.js');
        } catch {
          isFirebaseMessagingSw = scriptUrl.includes('/firebase-messaging-sw.js');
        }
      }

      if (!isFirebaseMessagingSw) {
        reg.unregister();
      }
    });
  });

  if (window.caches?.keys) {
    caches.keys().then(keys => {
      keys.forEach(k => {
        if (k.startsWith('talc-cache')) {
          caches.delete(k);
        }
      });
    });
  }
}