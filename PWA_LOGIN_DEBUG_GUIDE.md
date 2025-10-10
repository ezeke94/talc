# CRITICAL PWA Login Fixes - Round 2

## What Changed (Beyond Service Worker)

### 1. Firebase Auth Persistence Check
**File: `src/pages/Login.jsx`**
- Now waits for `persistencePromise` BEFORE attempting sign-in
- Logs auth domain and current URL for debugging
- Critical for PWAs where auth state must survive across sessions

### 2. PWA-Specific OAuth Configuration  
**File: `src/firebase/config.js`**
- Detects if app is in PWA mode at initialization
- Sets `display: 'page'` parameter for better PWA compatibility
- Logs Firebase config in dev mode for debugging

### 3. Enhanced Redirect Result Handling
**File: `src/context/AuthContext.jsx`**
- `getRedirectResult()` is now properly awaited and logged
- Redirect user takes precedence over regular auth state
- Better error logging with specific error codes
- Preserves redirect user through the onAuthStateChanged callback

## How to Test & Debug

### Step 1: Test in Browser First
```
1. Open http://localhost:5173 (or your deployed URL)
2. Open DevTools Console
3. Click "Sign In with Google"
4. Should see:
   ✓ "Login: Auth persistence confirmed"
   ✓ "Login: Starting sign-in process"
   ✓ Popup opens with Google login
   ✓ After login: "AuthStateChanged fired. User present? true"
```

**If browser login fails:**
- Check console for Firebase config errors
- Verify VITE_FIREBASE_* env variables are set
- Check Network tab for auth/ errors

### Step 2: Install as PWA
**Windows:**
```
1. In Edge/Chrome, click install icon in address bar
2. App opens in new window
3. Check console for: "Firebase: Configuring auth for PWA mode"
4. Should also see: "App is running in standalone mode"
```

**Android:**
```
1. In Chrome, Menu → "Add to Home Screen"
2. Open from home screen  
3. Check via Chrome Remote Debugging (chrome://inspect)
```

**iOS:**
```
1. Safari → Share → "Add to Home Screen"
2. Open from home screen
3. Use Safari Web Inspector (Mac) to see console
```

### Step 3: Test PWA Login
```
1. In installed PWA, click "Sign In with Google"
2. Watch console closely for these messages:

Expected Success Flow:
✓ "Login: Auth persistence confirmed"
✓ "Login: Starting sign-in process { isStandalone: true, ... }"
✓ "Login: Using redirect sign-in for standalone mode"
✓ Page redirects to accounts.google.com
✓ After selecting Google account, redirects back
✓ "Checking for redirect sign-in result..."
✓ "✓ Redirect sign-in successful: user@example.com"
✓ "AuthStateChanged fired. User present? true user@example.com"
✓ "Actual user to process: user@example.com"
✓ "AuthContext: Firestore user doc data: { role: '...', ... }"
```

### Step 4: Common Error Messages & Fixes

#### Error: "auth/unauthorized-domain"
```
CAUSE: Your domain isn't whitelisted in Firebase
FIX:
1. Go to Firebase Console → Authentication → Settings
2. Click "Authorized domains"  
3. Add your domain (e.g., your-app.netlify.app)
```

#### Error: "auth/web-storage-unsupported"
```
CAUSE: IndexedDB/localStorage is blocked
FIX:
1. Check browser settings → Privacy
2. Allow cookies and site data
3. Disable "Block third-party cookies" for testing
4. Clear cache and try again
```

#### Error: "auth/operation-not-supported-in-this-environment"
```
CAUSE: Auth redirect not supported in current context
FIX:
1. Verify authDomain in Firebase config
2. Check that app is actually in PWA mode
3. Try forcing popup mode: add ?authMode=popup to URL
```

#### Error: "No redirect result (user may have been on login page...)"
```
This is NORMAL if:
- User just opened the app
- User is on login page but hasn't clicked login yet
- User cancelled the Google login

This is a PROBLEM if:
- User clicked login, redirected to Google, logged in
- But this message appears after redirect back
- This means redirect result was lost

FIX:
- Check service worker isn't caching /__/auth paths
- Verify Network tab shows /__/auth/handler request (not from cache)
- Check for CORS errors in Network tab
```

#### Redirect happens but user not logged in:
```
CHECK:
1. Console shows "Checking for redirect sign-in result..."
2. But NOT "✓ Redirect sign-in successful"  
3. Instead shows error or "No redirect result"

CAUSES:
a) Service worker cached the redirect response
b) OAuth redirect URI not whitelisted
c) Third-party cookies blocked
d) authDomain mismatch

DEBUG:
1. DevTools → Application → Clear storage
2. Uninstall and reinstall PWA
3. Check Network tab for /__/auth/handler (should be 200, not cached)
4. Verify Google Cloud Console OAuth Client redirect URIs
```

### Step 5: Verify Auth Persistence
```
1. Login successfully in PWA
2. DevTools → Application → IndexedDB
3. Should see: firebaseLocalStorageDb
4. Expand → firebaseLocalStorage
5. Should contain auth token

6. Close PWA completely
7. Reopen from home screen/start menu
8. Should automatically be logged in (no login button)
9. Console should show:
   ✓ "AuthStateChanged fired. User present? true"
   ✓ "PWA: App became visible"
```

## Firebase Console Configuration Checklist

### Firebase Console
```
□ Project Settings → General → Web API Key (exists)
□ Authentication → Sign-in method → Google (enabled)
□ Authentication → Settings → Authorized domains:
  □ localhost (for development)
  □ your-domain.netlify.app (or your production domain)
  □ kpi-talc.firebaseapp.com (default Firebase hosting)
```

### Google Cloud Console  
```
1. Go to https://console.cloud.google.com
2. Select your Firebase project
3. APIs & Services → Credentials
4. Find OAuth 2.0 Client ID (Web client)
5. Authorized redirect URIs must include:
   □ http://localhost (for dev)
   □ https://kpi-talc.firebaseapp.com/__/auth/handler
   □ https://your-domain.netlify.app/__/auth/handler
```

## Environment Variables Check
```powershell
# Check if env vars are set (run in project root)
$env:VITE_FIREBASE_API_KEY
$env:VITE_FIREBASE_AUTH_DOMAIN  # Should be: kpi-talc.firebaseapp.com
$env:VITE_FIREBASE_PROJECT_ID
$env:VITE_FIREBASE_APP_ID
```

## What to Share for Debugging

If it still doesn't work, please provide:

1. **Platform**: Windows/Android/iOS
2. **Browser**: Edge/Chrome/Safari
3. **Mode**: Browser tab or installed PWA?
4. **Console Logs**: Copy/paste or screenshot from:
   - When app first opens
   - When clicking "Sign In with Google"
   - After redirect back from Google
5. **Network Tab**: Screenshot of:
   - /__/auth/handler request (Status, Headers, Response)
   - Any failed requests
6. **Application Tab**:
   - Service Workers status (active/waiting/none)
   - IndexedDB → firebaseLocalStorageDb content
7. **Specific Error**: Exact error message if any

## Next Debugging Steps

If login STILL fails after these fixes, the issue is likely:

1. **Third-party cookie blocking** (most common on Safari/iOS)
   - Test in incognito/private mode
   - Disable tracking protection temporarily
   
2. **OAuth redirect URI mismatch**
   - The redirect URI Firebase is using doesn't match Google Cloud config
   - Check exact URLs in both places
   
3. **Service worker from old deployment**
   - Force update: DevTools → Application → Service Workers → Unregister
   - Clear all site data
   - Hard refresh (Ctrl+Shift+R)
   
4. **CORS/Mixed content issues**
   - All URLs must be HTTPS in production
   - Check browser console for CORS errors
