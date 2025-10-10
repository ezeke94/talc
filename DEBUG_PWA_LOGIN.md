# DEBUG: PWA Login Investigation

## What to check in the browser console when testing:

1. Open DevTools → Console
2. Install the PWA
3. Try to login
4. Look for these specific errors:

### Common PWA Auth Errors:

```
auth/unauthorized-domain
auth/operation-not-supported-in-this-environment  
auth/web-storage-unsupported
auth/internal-error
auth/network-request-failed
auth/popup-closed-by-user (shouldn't happen with redirect)
```

### Check these in DevTools → Application:

1. **Service Workers tab:**
   - Is service-worker.js registered and active?
   - Scope should be "/"
   
2. **IndexedDB:**
   - Check for `firebaseLocalStorageDb` database
   - Should contain auth tokens
   
3. **Local Storage:**
   - Check for `firebase:authUser:*` keys
   - These store the current user session

4. **Network tab:**
   - Filter by `/__/auth`
   - Should see requests to Firebase Auth handler
   - Status should be 200, not cached

### Specific PWA Issues to Check:

1. **Third-Party Cookies:**
   - PWAs need third-party cookies enabled for OAuth
   - Check browser settings

2. **Referrer Policy:**
   - Check if referrer is being sent correctly
   
3. **Mixed Content:**
   - All requests must be HTTPS in PWA mode

## Manual Testing Steps:

### Test 1: Browser Mode First
```
1. Open app in regular browser tab
2. Try login - should work with popup
3. If this fails, Firebase config is wrong
```

### Test 2: PWA Mode
```
1. Install as PWA
2. Open from home screen/start menu
3. Check console for "App is running in standalone mode"
4. Try login - should use redirect
5. Watch console for errors
```

### Test 3: Check Redirect Happens
```
1. In PWA, click "Sign In with Google"
2. Should see: "Login: Using redirect sign-in for standalone mode"
3. Page should redirect to accounts.google.com
4. After login, should redirect back to your app
5. URL should briefly show /__/auth/handler with query params
```

### Test 4: Check Auth State Persistence
```
1. Login successfully in PWA
2. Close the PWA completely
3. Reopen from home screen
4. Should still be logged in (from IndexedDB)
```

## What's the actual error message you're seeing?

Please share:
1. Platform (Windows/Android/iOS)
2. Browser console errors (screenshot or copy/paste)
3. Network tab showing failed requests
4. Whether login works in browser but not PWA, or doesn't work at all
