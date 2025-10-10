# PWA Login Fix - Deployment Verification Script

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "PWA Login Fix - Deployment Verification" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Check if build exists
if (Test-Path "dist") {
    Write-Host "✓ Build directory exists" -ForegroundColor Green
} else {
    Write-Host "✗ Build directory not found. Run 'npm run build' first." -ForegroundColor Red
    exit 1
}

# Verify service-worker.js has OAuth handling
$swContent = Get-Content "dist\service-worker.js" -Raw
if ($swContent -match "g_csrf_token" -and $swContent -match "/__/auth") {
    Write-Host "✓ Service worker has OAuth handling" -ForegroundColor Green
} else {
    Write-Host "✗ Service worker missing OAuth handling" -ForegroundColor Red
    exit 1
}

# Verify manifest has source tracking
$manifest = Get-Content "dist\manifest.json" | ConvertFrom-Json
if ($manifest.start_url -match "source=pwa") {
    Write-Host "✓ Manifest has source tracking" -ForegroundColor Green
} else {
    Write-Host "⚠ Manifest missing source tracking (non-critical)" -ForegroundColor Yellow
}

# Verify index.html has service worker registration
$indexContent = Get-Content "dist\index.html" -Raw
if ($indexContent -match "service-worker.js" -and $indexContent -match "getRegistration") {
    Write-Host "✓ Index.html has service worker registration with guard" -ForegroundColor Green
} else {
    Write-Host "✗ Index.html missing service worker registration" -ForegroundColor Red
    exit 1
}

# Check if firebase config exists
if (Test-Path "dist\firebase-config.js") {
    Write-Host "✓ Firebase config exists" -ForegroundColor Green
} else {
    Write-Host "⚠ Firebase config not found (may be generated at runtime)" -ForegroundColor Yellow
}

# Check if firebase messaging SW exists
if (Test-Path "dist\firebase-messaging-sw.js") {
    Write-Host "✓ Firebase messaging service worker exists" -ForegroundColor Green
} else {
    Write-Host "⚠ Firebase messaging service worker not found" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Build Verification Summary" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# List critical files
Write-Host "Critical Files:" -ForegroundColor White
$criticalFiles = @(
    "dist\index.html",
    "dist\manifest.json", 
    "dist\service-worker.js",
    "dist\firebase-messaging-sw.js",
    "dist\firebase-config.js"
)

foreach ($file in $criticalFiles) {
    if (Test-Path $file) {
        $size = (Get-Item $file).Length
        Write-Host "  [OK] $file ($size bytes)" -ForegroundColor Green
    } else {
        Write-Host "  [MISSING] $file" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Pre-Deployment Checklist" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Before deploying, ensure:" -ForegroundColor White
Write-Host "  [ ] Firebase Console → Auth → Authorized domains includes your domain" -ForegroundColor Yellow
Write-Host "  [ ] Google Cloud Console → OAuth Client → Redirect URIs includes:" -ForegroundColor Yellow
Write-Host "      - https://kpi-talc.firebaseapp.com/__/auth/handler" -ForegroundColor Cyan
Write-Host "      - https://your-domain.netlify.app/__/auth/handler" -ForegroundColor Cyan
Write-Host "  [ ] VITE_FIREBASE_* environment variables are set in Netlify" -ForegroundColor Yellow
Write-Host "  [ ] VITE_FIREBASE_VAPID_KEY is set for notifications" -ForegroundColor Yellow
Write-Host ""

Write-Host "Deploy Command:" -ForegroundColor White
Write-Host "  netlify deploy --prod" -ForegroundColor Cyan
Write-Host ""

Write-Host "After Deployment:" -ForegroundColor White
Write-Host "  1. Test login in browser mode" -ForegroundColor Yellow
Write-Host "  2. Install PWA on Windows (Edge/Chrome)" -ForegroundColor Yellow
Write-Host "  3. Install PWA on Android (Chrome)" -ForegroundColor Yellow
Write-Host "  4. Install PWA on iOS (Safari)" -ForegroundColor Yellow
Write-Host "  5. Test login in each installed PWA" -ForegroundColor Yellow
Write-Host ""

Write-Host "Documentation:" -ForegroundColor White
Write-Host "  - PWA_LOGIN_FIX_SUMMARY.md (executive summary)" -ForegroundColor Cyan
Write-Host "  - docs/PWA_LOGIN_FIX.md (technical details)" -ForegroundColor Cyan
Write-Host "  - PWA_LOGIN_TEST_CHECKLIST.md (testing steps)" -ForegroundColor Cyan
Write-Host ""

Write-Host "[OK] Build verification complete!" -ForegroundColor Green
Write-Host "Ready to deploy to production." -ForegroundColor Green
Write-Host ""
