@echo off
echo ========================================
echo PWA Login - Environment Check
echo ========================================
echo.

echo Checking Firebase environment variables...
echo.

if defined VITE_FIREBASE_API_KEY (
    echo [OK] VITE_FIREBASE_API_KEY is set
) else (
    echo [ERROR] VITE_FIREBASE_API_KEY is NOT set
)

if defined VITE_FIREBASE_AUTH_DOMAIN (
    echo [OK] VITE_FIREBASE_AUTH_DOMAIN = %VITE_FIREBASE_AUTH_DOMAIN%
) else (
    echo [ERROR] VITE_FIREBASE_AUTH_DOMAIN is NOT set
    echo        This MUST be: kpi-talc.firebaseapp.com
)

if defined VITE_FIREBASE_PROJECT_ID (
    echo [OK] VITE_FIREBASE_PROJECT_ID = %VITE_FIREBASE_PROJECT_ID%
) else (
    echo [ERROR] VITE_FIREBASE_PROJECT_ID is NOT set
)

if defined VITE_FIREBASE_STORAGE_BUCKET (
    echo [OK] VITE_FIREBASE_STORAGE_BUCKET is set
) else (
    echo [ERROR] VITE_FIREBASE_STORAGE_BUCKET is NOT set
)

if defined VITE_FIREBASE_MESSAGING_SENDER_ID (
    echo [OK] VITE_FIREBASE_MESSAGING_SENDER_ID is set
) else (
    echo [ERROR] VITE_FIREBASE_MESSAGING_SENDER_ID is NOT set
)

if defined VITE_FIREBASE_APP_ID (
    echo [OK] VITE_FIREBASE_APP_ID is set
) else (
    echo [ERROR] VITE_FIREBASE_APP_ID is NOT set
)

if defined VITE_FIREBASE_VAPID_KEY (
    echo [OK] VITE_FIREBASE_VAPID_KEY is set (for notifications)
) else (
    echo [WARN] VITE_FIREBASE_VAPID_KEY is NOT set (notifications won't work)
)

echo.
echo ========================================
echo Check Firebase Console Configuration:
echo ========================================
echo.
echo 1. Firebase Console URL:
echo    https://console.firebase.google.com/project/kpi-talc/authentication/settings
echo.
echo 2. Verify Authorized Domains include:
echo    - localhost
echo    - kpitalc.netlify.app
echo    - kpi-talc.firebaseapp.com
echo.
echo 3. Google Cloud Console OAuth:
echo    https://console.cloud.google.com/apis/credentials
echo.
echo 4. Verify OAuth 2.0 Client redirect URIs include:
echo    - https://kpi-talc.firebaseapp.com/__/auth/handler
echo    - https://kpitalc.netlify.app/__/auth/handler
echo.
echo ========================================
echo.

pause
