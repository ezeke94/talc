# TALC Notifications Deployment Script for Windows
# Run this from the project root directory in PowerShell

Write-Host "🚀 Deploying TALC Notification System..." -ForegroundColor Green

# Check if we're in the right directory
if (!(Test-Path "package.json")) {
    Write-Host "❌ Error: Please run this script from the project root directory" -ForegroundColor Red
    exit 1
}

# Check if firebase CLI is installed
if (!(Get-Command firebase -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Error: Firebase CLI not found. Install with: npm install -g firebase-tools" -ForegroundColor Red
    exit 1
}

# Check if logged in to Firebase
try {
    firebase projects:list | Out-Null
} catch {
    Write-Host "🔐 Please login to Firebase..." -ForegroundColor Yellow
    firebase login
}

Write-Host "📦 Installing function dependencies..." -ForegroundColor Blue
Set-Location functions
npm install
Set-Location ..

Write-Host "🔧 Generating Firebase config for service worker..." -ForegroundColor Blue
node scripts/generate-sw-config.js

Write-Host "🚀 Deploying Cloud Functions..." -ForegroundColor Blue
firebase deploy --only functions

Write-Host "📱 Building and deploying frontend..." -ForegroundColor Blue
npm run build
firebase deploy --only hosting

Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "1. Test notifications by creating an event due tomorrow"
Write-Host "2. Check Firebase Functions logs: firebase functions:log"
Write-Host "3. Verify FCM tokens are being saved in Firestore users collection"
Write-Host "4. Test different user roles (Quality team vs event owners)"
Write-Host ""
Write-Host "💡 Reminder: Event reminders will be sent at 4 PM UTC daily" -ForegroundColor Yellow
Write-Host "   - Owners get reminders 1 day before"
Write-Host "   - Quality team + owners get same-day reminders"