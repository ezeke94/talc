# PWA Login Fix Documentation

## Problem
Users were unable to log in when the TALC app was installed as a PWA (Progressive Web App) on Windows, Android, and iPhone. The OAuth redirect flow from Google was being intercepted or cached by the service worker, preventing successful authentication.

## Root Causes

### 1. **Service Worker Caching OAuth Redirects**
The service worker was caching navigation requests indiscriminately, including OAuth callback URLs with authentication tokens. This caused:
- Cached responses to be served instead of fresh OAuth redirects
- Query parameters (code, state, g_csrf_token) to be lost
- Firebase Auth unable to complete the redirect sign-in flow

### 2. **Aggressive Service Worker Unregistration**
The app was unregistering all non-Firebase-Messaging service workers on every load, even in production. This caused:
- The main service worker to never stay active in installed PWAs
- Navigation to fail or behave unpredictably
- OAuth redirects to potentially lose context

### 3. **Incomplete PWA Detection**
The app only detected iOS standalone and `display-mode: standalone`, missing:
- Windows PWA's `display-mode: window-controls-overlay` mode
- This caused Windows PWAs to attempt popup sign-in (often blocked) instead of redirect

## Solutions Implemented

### 1. Enhanced Service Worker OAuth Handling
**File: `public/service-worker.js`**

Added comprehensive OAuth parameter detection and Firebase Auth handler path exclusion:

```javascript
const oauthKeys = [
  'code', 'state', 'access_token', 'oauth_token', 'error', 'g_csrf_token', 'g_state',
  'id_token', 'redirect_fragment'
];
const hasOAuthParams = oauthKeys.some(k => url.searchParams.has(k));
const isAuthHandlerPath = path.startsWith('/__/auth') || path.includes('/auth/handler');

if (isAuthHandlerPath || (hasQuery && hasOAuthParams)) {
  // Let the browser perform a full network navigation for redirect results
  event.respondWith(fetch(event.request));
  return;
}
```

This ensures OAuth callbacks are NEVER cached and always hit the network.

### 2. Service Worker Lifecycle Management
**File: `src/main.jsx`**

Changed from aggressive unregistration to development-only cleanup:

```javascript
// Only unregister in development to avoid stale caches during hot reloads
// In production/standalone, keep the main service worker for proper PWA navigation
if ('serviceWorker' in navigator) {
  const isDev = import.meta?.env?.DEV;
  if (isDev) {
    // Only unregister in dev mode
  }
}
```

This allows the service worker to persist in production PWAs while still supporting clean dev builds.

### 3. Improved PWA Detection
**File: `src/utils/pwaUtils.js`**

Added detection for Windows PWA mode:

```javascript
export const isPWA = () => {
  try {
    return (
      window.navigator.standalone ||
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: window-controls-overlay)').matches || // Windows PWA
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches ||
      // ... other checks
    );
  } catch (e) {
    return false;
  }
};
```

### 4. Unified Login Flow
**File: `src/pages/Login.jsx`**

Simplified PWA detection to use shared utility:

```javascript
import { isPWA as isPWAEnv } from '../utils/pwaUtils';

const isStandalonePWA = () => {
  return !!isPWAEnv();
};
```

This ensures all PWAs (Windows/Android/iOS) use redirect sign-in instead of popups.

### 5. Auth Context Enhancements
**File: `src/context/AuthContext.jsx`**

Updated standalone detection to include Windows PWA mode:

```javascript
const isStandalone = () => {
  try {
    const isiOSStandalone = !!window.navigator?.standalone;
    const displayStandalone = window.matchMedia?.('(display-mode: standalone)')?.matches;
    const displayWCO = window.matchMedia?.('(display-mode: window-controls-overlay)')?.matches;
    return isiOSStandalone || displayStandalone || displayWCO;
  } catch (e) {
    return false;
  }
};
```

### 6. Manifest Start URL
**File: `public/manifest.json`**

Updated to include source tracking:

```json
"start_url": "/?source=pwa"
```

This helps distinguish PWA launches from regular browser visits for analytics and debugging.

### 7. Service Worker Registration Guard
**File: `index.html`**

Added duplicate registration prevention:

```javascript
navigator.serviceWorker.getRegistration('/service-worker.js').then((existing) => {
  if (existing) return;
  // Only register if not already registered
});
```

## Testing Instructions

### Windows (Edge/Chrome)
1. Open the app in Edge or Chrome
2. Click the install icon in the address bar (⊕ or Install)
3. App opens in window-controls-overlay mode
4. Click "Sign In with Google"
5. Should redirect to Google → back to app successfully
6. Verify you're logged in and redirected to dashboard

### Android (Chrome)
1. Open the app in Chrome on Android
2. Tap "Add to Home Screen" from the menu
3. Open from home screen (opens in standalone mode)
4. Tap "Sign In with Google"
5. Should redirect to Google login page
6. After selecting account, redirects back to app
7. Verify successful login

### iPhone (Safari)
1. Open the app in Safari
2. Tap Share → "Add to Home Screen"
3. Open from home screen (opens in standalone mode)
4. Tap "Sign In with Google"
5. Should redirect to Google in Safari view
6. After login, returns to standalone app
7. Verify successful login

## Debug Console Messages

When testing, check the browser console for these key messages:

```
✓ PWA: Initializing PWA handlers
✓ App is running in standalone mode (for installed PWAs)
✓ Firebase: IndexedDB persistence configured successfully
✓ Login: Starting sign-in process { isStandalone: true, authModeOverride: null }
✓ Login: Using redirect sign-in for standalone mode
✓ AuthStateChanged fired. User present? true
```

## Firebase Console Configuration

Ensure your Firebase project has the following OAuth redirect URIs whitelisted:

1. Go to Firebase Console → Authentication → Settings → Authorized domains
2. Add your production domain (e.g., `talc-app.netlify.app`)
3. For Google OAuth:
   - Go to Google Cloud Console → APIs & Services → Credentials
   - Edit OAuth 2.0 Client ID
   - Add authorized redirect URIs:
     - `https://kpi-talc.firebaseapp.com/__/auth/handler`
     - `https://your-domain.com/__/auth/handler`
     - `https://your-domain.netlify.app/__/auth/handler`

## Common Issues and Solutions

### Issue: "Sign-in via redirect failed"
**Solution:** Check that:
- Service worker is not caching `/__/auth/*` paths
- OAuth redirect URI is whitelisted in Firebase/Google Console
- Browser allows third-party cookies (required for OAuth)

### Issue: Infinite loading after clicking login
**Solution:** Check that:
- `persistencePromise` in `firebase/config.js` is resolving
- IndexedDB is available and not blocked
- Check console for `auth/web-storage-unsupported` errors

### Issue: Works in browser but not when installed
**Solution:** Check that:
- Service worker is registered and active (check DevTools → Application → Service Workers)
- `isPWA()` returns true when installed (check console logs)
- Redirect sign-in is being used instead of popup

## Files Modified

1. `public/service-worker.js` - Enhanced OAuth handling
2. `src/main.jsx` - Conditional SW unregistration
3. `src/utils/pwaUtils.js` - Windows PWA detection
4. `src/pages/Login.jsx` - Unified PWA detection
5. `src/context/AuthContext.jsx` - Enhanced standalone detection
6. `public/manifest.json` - Start URL with source tracking
7. `index.html` - Duplicate registration prevention

## Performance Impact

- No negative performance impact
- Service worker still caches static assets
- Only OAuth flows bypass cache (necessary for security)
- PWA install and offline functionality preserved

## Security Considerations

- OAuth flows MUST use network to prevent token replay
- Service worker cannot cache authenticated responses
- IndexedDB persistence for auth state is secure and encrypted by browser
- Third-party cookies still required for Google OAuth (browser limitation)

## Future Enhancements

1. Consider using Firebase Auth's new `signInWithCustomToken` for PWAs if Google introduces PWA-specific OAuth flows
2. Add telemetry to track PWA login success rates
3. Implement fallback authentication method for environments where OAuth is blocked
4. Add user-friendly error messages for common OAuth failures

## References

- [Firebase Auth for Web](https://firebase.google.com/docs/auth/web/start)
- [Google Identity Services](https://developers.google.com/identity/gsi/web)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [PWA Display Modes](https://developer.mozilla.org/en-US/docs/Web/Manifest/display)
