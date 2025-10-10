# Event Notification Fix Deployment Script
# This script deploys the Cloud Functions with the fixes for event notifications

Write-Host "=== Event Notification Fix Deployment ===" -ForegroundColor Cyan
Write-Host ""

# Check if Firebase CLI is installed
$firebaseInstalled = Get-Command firebase -ErrorAction SilentlyContinue
if (-not $firebaseInstalled) {
    Write-Host "ERROR: Firebase CLI not found. Please install it first:" -ForegroundColor Red
    Write-Host "npm install -g firebase-tools" -ForegroundColor Yellow
    exit 1
}

Write-Host "Step 1: Checking Firebase login status..." -ForegroundColor Yellow
firebase login:list

Write-Host ""
Write-Host "Step 2: Installing/updating function dependencies..." -ForegroundColor Yellow
Push-Location functions
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to install dependencies" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location

Write-Host ""
Write-Host "Step 3: Deploying Cloud Functions..." -ForegroundColor Yellow
firebase deploy --only functions

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Deployment failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 4: Listing deployed functions..." -ForegroundColor Yellow
firebase functions:list

Write-Host ""
Write-Host "=== Deployment Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Expected Functions:" -ForegroundColor Cyan
Write-Host "  ✓ sendOwnerEventReminders (scheduled)"
Write-Host "  ✓ sendQualityTeamEventReminders (scheduled)"
Write-Host "  ✓ sendWeeklyOverdueTaskReminders (scheduled)"
Write-Host "  ✓ sendNotificationsOnEventCreate (Firestore - NEW)" -ForegroundColor Green
Write-Host "  ✓ sendWeeklyKPIReminders (scheduled)"
Write-Host "  ✓ notifyEventReschedule (Firestore)"
Write-Host "  ✓ notifyEventCancellation (Firestore)"
Write-Host "  ✓ notifyEventCompletion (Firestore)"
Write-Host "  ✓ notifyEventDelete (Firestore)"
Write-Host "  ✓ sendMonthlyOperationalSummary (scheduled)"
Write-Host "  ✓ sendCriticalSystemAlert (HTTP)"
Write-Host "  ✓ helloWorld (HTTP)"
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Test event creation notifications"
Write-Host "2. Test event deletion (should receive only ONE notification)"
Write-Host "3. Monitor Cloud Functions logs for any errors"
Write-Host "4. Check Firebase Console > Functions for execution logs"
Write-Host ""
Write-Host "If you see duplicate notifyEventDelete functions, delete the old ones:" -ForegroundColor Yellow
Write-Host "  firebase functions:delete notifyEventDelete" -ForegroundColor Gray
Write-Host ""
