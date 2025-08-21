import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import './index.css';

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
    h4: {
      fontWeight: 700,
      fontSize: '1.75rem',
      '@media (min-width:600px)': {
        fontSize: '2rem',
      },
    },
    h5: {
      fontWeight: 600,
      fontSize: '1.25rem',
      '@media (min-width:600px)': {
        fontSize: '1.5rem',
      },
    },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 16px rgba(41,45,52,0.06)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600,
          padding: '8px 16px',
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 16px rgba(41,45,52,0.06)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0 4px 24px rgba(123,198,120,0.25)'
        }
      }
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

// Service worker handling
// In development, unregister any existing SW to avoid stale caching during HMR.
// In production, register the SW served from public/ at the site root.
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js')
        .then(reg => {
          console.log('Service worker registered:', reg);
          // Listen for updates to the service worker.
          if (reg.waiting) {
            console.log('A new service worker is waiting. Call window.activateNewSW() to activate.');
          }

          reg.addEventListener?.('updatefound', () => {
            const newWorker = reg.installing;
            if (!newWorker) return;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  // New update available
                  console.log('New service worker installed and waiting. Call window.activateNewSW() to activate.');
                } else {
                  // First install
                  console.log('Service worker installed for the first time.');
                }
              }
            });
          });

          // Expose a helper to activate the new SW from the console for testing
          window.activateNewSW = () => {
            if (!reg.waiting) return console.log('No waiting service worker');
            reg.waiting.postMessage('SKIP_WAITING');
            console.log('Sent SKIP_WAITING to waiting service worker');
          };
        })
        .catch(err => {
          console.error('Service worker registration failed:', err);
        });
    });
  } else {
    // Dev mode: make sure any existing SW is removed
    navigator.serviceWorker.getRegistrations?.().then(regs => {
      regs.forEach(r => r.unregister());
    });
    // Best-effort: clear our app caches to avoid serving stale index.html
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
}