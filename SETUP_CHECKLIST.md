# 🔧 FINAL SETUP CHECKLIST - PWA Login Fix

## ✅ Firebase Console Configuration

### 1. Authorized Domains
**URL:** https://console.firebase.google.com/project/kpi-talc/authentication/settings

Navigate to: **Authentication → Settings → Authorized domains**

Add these domains:
- [ ] `localhost` (for local development)
- [ ] `kpitalc.netlify.app` (your production domain)
- [ ] `kpi-talc.firebaseapp.com` (Firebase hosting - already there)

**CRITICAL:** Without `kpitalc.netlify.app` in this list, OAuth redirect will fail with `auth/unauthorized-domain` error.

---

## ✅ Google Cloud Console - OAuth Configuration

### 2. OAuth 2.0 Client Redirect URIs
**URL:** https://console.cloud.google.com/apis/credentials

Steps:
1. Find your OAuth 2.0 Client ID (usually named "Web client (auto created by Google Service)")
2. Click Edit
3. Under "Authorized redirect URIs", add:
   - [ ] `https://kpi-talc.firebaseapp.com/__/auth/handler`
   - [ ] `https://kpitalc.netlify.app/__/auth/handler`
   - [ ] `http://localhost` (for local dev)

**CRITICAL:** The redirect URI MUST exactly match your deployed domain. Missing `https://kpitalc.netlify.app/__/auth/handler` will cause redirect to fail silently.

---

## ✅ Netlify Environment Variables

### 3. Set Environment Variables in Netlify
**URL:** https://app.netlify.com/sites/kpitalc/settings/deploys#environment

Navigate to: **Site settings → Build & deploy → Environment variables**

Add these variables:
```
VITE_FIREBASE_API_KEY=AIzaSyDdCtN1WsoNtMFAwEUDv34pJy4lT6a3I38
VITE_FIREBASE_AUTH_DOMAIN=kpi-talc.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=kpi-talc
VITE_FIREBASE_STORAGE_BUCKET=kpi-talc.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=67217863373
VITE_FIREBASE_APP_ID=1:67217863373:web:d014a8576b8bd7cfdd6f84
VITE_FIREBASE_VAPID_KEY=[Get from Firebase Console → Cloud Messaging]
```

**IMPORTANT:** After adding/changing environment variables, you MUST trigger a new deploy for them to take effect.

---

## ✅ Local Development Setup

### 4. Create .env File
Create a file named `.env` in the project root with:

```bash
VITE_FIREBASE_API_KEY=AIzaSyDdCtN1WsoNtMFAwEUDv34pJy4lT6a3I38
VITE_FIREBASE_AUTH_DOMAIN=kpi-talc.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=kpi-talc
VITE_FIREBASE_STORAGE_BUCKET=kpi-talc.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=67217863373
VITE_FIREBASE_APP_ID=1:67217863373:web:d014a8576b8bd7cfdd6f84
```

**NOTE:** `.env` is in `.gitignore` and should NOT be committed.

---

## ✅ Testing Checklist

### 5. Test Login Flow

**Step 1: Test Locally**
```powershell
# Verify env vars are loaded
.\check-env.bat

# Start dev server
npm run dev

# Open http://localhost:5173
# Click "Sign In with Google"
# Should open popup and login successfully
```

**Step 2: Test on Production (Browser Mode)**
```
1. Open https://kpitalc.netlify.app in browser
2. Click "Sign In with Google"
3. Should open popup or redirect
4. Login should succeed
5. Should redirect to dashboard
```

**Step 3: Test PWA Mode**

**Windows (Edge/Chrome):**
```
1. Go to https://kpitalc.netlify.app
2. Click install icon in address bar
3. Open installed app
4. Click "Sign In with Google"
5. Should redirect to Google (not popup)
6. After login, should return to app
7. Should see dashboard with user logged in
```

**Android (Chrome):**
```
1. Open https://kpitalc.netlify.app in Chrome
2. Menu → "Add to Home Screen"
3. Open from home screen
4. Click "Sign In with Google"  
5. Chrome Custom Tab opens
6. Login with Google
7. Returns to app, logged in
```

**iPhone (Safari):**
```
1. Open https://kpitalc.netlify.app in Safari
2. Share → "Add to Home Screen"
3. Open from home screen
4. Click "Sign In with Google"
5. Redirects to Google in Safari view
6. Login with Google
7. Returns to standalone app, logged in
```

---

## ✅ Common Issues & Solutions

### Issue: "auth/unauthorized-domain"
**Solution:** 
- Add `kpitalc.netlify.app` to Firebase Console → Authentication → Authorized domains
- Wait 1-2 minutes for changes to propagate
- Clear browser cache and try again

### Issue: Redirect happens but no login
**Solution:**
- Verify `https://kpitalc.netlify.app/__/auth/handler` is in Google Cloud Console OAuth redirect URIs
- Check Network tab for /__/auth/handler request (should be 200, not cached)
- Clear service worker: DevTools → Application → Service Workers → Unregister

### Issue: "Configuration object is invalid"
**Solution:**
- Environment variables not set in Netlify
- Redeploy after setting env vars
- Check build logs for VITE_FIREBASE_* references

### Issue: Works in browser but not in PWA
**Solution:**
- Third-party cookies must be enabled
- Check service worker isn't caching OAuth paths
- Verify PWA is actually in standalone mode (check console for "App is running in standalone mode")

---

## ✅ Verification Steps

After completing all setup:

1. **Check Firebase Console:**
   - [ ] Authorized domains includes `kpitalc.netlify.app`
   - [ ] Google sign-in method is enabled

2. **Check Google Cloud Console:**
   - [ ] OAuth redirect URIs includes `https://kpitalc.netlify.app/__/auth/handler`

3. **Check Netlify:**
   - [ ] All VITE_FIREBASE_* environment variables are set
   - [ ] Site has been redeployed after setting env vars

4. **Test Login:**
   - [ ] Works in browser mode on desktop
   - [ ] Works in installed PWA on Windows
   - [ ] Works in installed PWA on Android
   - [ ] Works in installed PWA on iOS

5. **Check Console Logs:**
   - [ ] "Firebase: IndexedDB persistence configured successfully"
   - [ ] "✓ Redirect sign-in successful: user@example.com"
   - [ ] "AuthStateChanged fired. User present? true"

---

## 🚀 Deploy to Production

```powershell
# Build locally to verify
npm run build

# Deploy to Netlify
netlify deploy --prod

# Or let Netlify auto-deploy on git push
git add .
git commit -m "Fix PWA login with proper auth configuration"
git push origin main
```

---

## 📞 If Still Not Working

Collect this information:
1. **Screenshot of Firebase Console → Authorized domains**
2. **Screenshot of Google Cloud Console → OAuth redirect URIs**
3. **Screenshot of Netlify → Environment variables** (hide sensitive values)
4. **Browser console errors** when clicking login
5. **Network tab** showing /__/auth/handler request/response
6. **Platform tested:** Windows/Android/iOS + Browser/PWA mode

This will help identify the exact configuration issue.

---

## ✨ Success Indicators

When everything is working correctly:

**Browser Console:**
```
✓ Firebase Config: { authDomain: "kpi-talc.firebaseapp.com", ... }
✓ Firebase: IndexedDB persistence configured successfully
✓ Login: Starting sign-in process
✓ Login: Using redirect sign-in for standalone mode (PWA) 
   OR Login: Attempting popup sign-in (browser)
✓ Checking for redirect sign-in result...
✓ ✓ Redirect sign-in successful: user@example.com
✓ AuthStateChanged fired. User present? true user@example.com
✓ Actual user to process: user@example.com
```

**User Experience:**
- Click "Sign In with Google" → redirects/popup opens
- Select Google account
- Returns to app
- Dashboard loads with user profile visible
- No error messages
- Can navigate app normally
- Closing and reopening PWA keeps user logged in
