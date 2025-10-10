# PWA Login Testing Checklist

## Quick Test Guide for PWA Login Fix

### ✅ Pre-Test Setup
- [ ] Build completed: `npm run build`
- [ ] Deploy to staging/production (Netlify)
- [ ] Verify Firebase OAuth redirect URIs include your domain

---

## 🪟 Windows Testing (Edge or Chrome)

### Install PWA
1. Open app in Edge/Chrome: `https://your-domain.netlify.app`
2. Look for install icon in address bar (⊕ or app icon)
3. Click "Install TALC Management"
4. App opens in new window with title bar (window-controls-overlay mode)

### Test Login
1. Click "Sign In with Google" button
2. **Expected:** Browser redirects to Google login page
3. Select/enter Google account
4. **Expected:** Redirects back to app
5. **Expected:** User is logged in and sees dashboard/calendar
6. **Check Console:** Should see `Login: Using redirect sign-in for standalone mode`

### Debug if Fails
- Open DevTools (F12) → Console tab
- Look for errors containing "auth" or "redirect"
- Check Application → Service Workers → verify service-worker.js is active
- Check Network tab → look for `/__/auth/handler` requests (should not be cached)

---

## 🤖 Android Testing (Chrome)

### Install PWA
1. Open app in Chrome on Android
2. Tap menu (⋮) → "Add to Home Screen"
3. Tap "Add" on confirmation dialog
4. Open app from home screen (opens fullscreen)

### Test Login
1. Tap "Sign In with Google" button
2. **Expected:** Chrome Custom Tab opens with Google login
3. Sign in with Google account
4. **Expected:** Returns to app automatically
5. **Expected:** User is logged in
6. **Check:** App shows user name/email in top nav/profile

### Debug if Fails
- Connect device to PC and use Chrome Remote Debugging
- Check `chrome://inspect/#devices`
- Look for console errors
- Verify service worker is registered

---

## 🍎 iPhone Testing (Safari)

### Install PWA
1. Open app in Safari on iPhone
2. Tap Share button (square with arrow)
3. Scroll and tap "Add to Home Screen"
4. Tap "Add"
5. Open app from home screen

### Test Login
1. Tap "Sign In with Google" button
2. **Expected:** Safari view opens with Google login
3. Sign in with Google account
4. **Expected:** Redirects back to installed app
5. **Expected:** User is logged in

### Debug if Fails
- On Mac: Connect iPhone and use Safari Web Inspector
- On iPhone: Settings → Safari → Advanced → Web Inspector (ON)
- Check for console errors
- Verify redirect returns to app (not stuck in Safari)

---

## 🧪 Advanced Testing

### Test Offline Behavior
1. Install PWA on any platform
2. Log in successfully
3. Close app
4. Turn off internet/go to airplane mode
5. Reopen app from home screen
6. **Expected:** App loads from cache
7. **Expected:** User remains logged in (from IndexedDB)

### Test Service Worker Update
1. Make a small change to `public/service-worker.js` (e.g., bump cache version)
2. Build and deploy
3. Open installed PWA
4. Hard refresh or wait for update
5. **Expected:** New service worker installs
6. **Expected:** Login still works

### Test Multiple Devices
1. Log in on Windows PWA
2. Log in on Android PWA with same account
3. Log in on iPhone PWA with same account
4. **Expected:** All devices receive FCM notifications
5. Check Firestore → `users/{uid}/devices` collection

---

## 🔍 Console Verification

### Expected Console Messages (Successful Login)
```
PWA: Initializing PWA handlers
App is running in standalone mode
Firebase: IndexedDB persistence configured successfully
Login: Starting sign-in process { isStandalone: true }
Login: Using redirect sign-in for standalone mode
AuthStateChanged fired. User present? true
AuthContext: Firestore user doc data: { role: "...", isActive: true }
```

### Common Error Messages and Fixes

**Error:** `auth/popup-blocked`
- **Fix:** This shouldn't happen in PWA mode (we use redirect)
- **Check:** Verify `isPWA()` returns true

**Error:** `auth/network-request-failed`
- **Fix:** Check internet connection
- **Fix:** Verify Firebase Auth domain is whitelisted

**Error:** `auth/unauthorized-domain`
- **Fix:** Add domain to Firebase Console → Authentication → Authorized domains

**Error:** `Sign-in via redirect failed`
- **Fix:** Clear cache and try again
- **Fix:** Check OAuth redirect URIs in Google Cloud Console

---

## 📊 Success Criteria

- ✅ Login works in browser mode (popup)
- ✅ Login works in Windows PWA (redirect)
- ✅ Login works in Android PWA (redirect)
- ✅ Login works in iOS PWA (redirect)
- ✅ User stays logged in after closing/reopening app
- ✅ Service worker doesn't cache OAuth responses
- ✅ No console errors during login flow

---

## 🚀 Deployment Checklist

Before deploying to production:
- [ ] Test on at least one device per platform (Windows/Android/iOS)
- [ ] Verify OAuth redirect URIs in Firebase Console
- [ ] Verify OAuth redirect URIs in Google Cloud Console
- [ ] Test with a fresh install (not just update)
- [ ] Test with cleared cache/cookies
- [ ] Verify notifications work after login
- [ ] Check Analytics/Firestore for successful logins

---

## 📞 Troubleshooting Contact

If login still fails after following this guide:

1. **Collect Debug Info:**
   - Platform (Windows/Android/iOS)
   - Browser/PWA mode
   - Console errors (screenshot)
   - Network tab showing failed requests

2. **Check Documentation:**
   - See `docs/PWA_LOGIN_FIX.md` for detailed explanation
   - Firebase Auth docs: https://firebase.google.com/docs/auth/web/redirect-best-practices

3. **Common Fixes:**
   - Clear browser cache completely
   - Uninstall and reinstall PWA
   - Check third-party cookies are enabled
   - Verify date/time on device is correct
