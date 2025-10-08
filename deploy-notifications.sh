#!/bin/bash

# TALC Notifications Deployment Script
# Run this from the project root directory

echo "🚀 Deploying TALC Notification System..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Check if firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Error: Firebase CLI not found. Install with: npm install -g firebase-tools"
    exit 1
fi

# Check if logged in to Firebase
if ! firebase projects:list &> /dev/null; then
    echo "🔐 Please login to Firebase..."
    firebase login
fi

echo "📦 Installing function dependencies..."
cd functions
npm install
cd ..

echo "🔧 Generating Firebase config for service worker..."
node scripts/generate-sw-config.js

echo "🚀 Deploying Cloud Functions..."
firebase deploy --only functions

echo "📱 Building and deploying frontend..."
npm run build
firebase deploy --only hosting

echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Test notifications by creating an event due tomorrow"
echo "2. Check Firebase Functions logs: firebase functions:log"
echo "3. Verify FCM tokens are being saved in Firestore users collection"
echo "4. Test different user roles (Quality team vs event owners)"
echo ""
echo "💡 Reminder: Event reminders will be sent at 4 PM UTC daily"
echo "   - Owners get reminders 1 day before"
echo "   - Quality team + owners get same-day reminders"