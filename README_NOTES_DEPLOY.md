Deploy notes - Firebase & Netlify

1) Build-time SW config
- This project includes `scripts/generate-sw-config.js` which writes `public/firebase-config.js` from environment variables.
- Ensure the following Netlify build environment variables are set (Site settings -> Build & deploy -> Environment):
  - VITE_FIREBASE_API_KEY
  - VITE_FIREBASE_AUTH_DOMAIN
  - VITE_FIREBASE_PROJECT_ID
  - VITE_FIREBASE_STORAGE_BUCKET
  - VITE_FIREBASE_MESSAGING_SENDER_ID
  - VITE_FIREBASE_APP_ID
  - VITE_FIREBASE_MEASUREMENT_ID (optional)

The build command in package.json runs the generator prior to `vite build` so the service worker can import `/firebase-config.js` at runtime.

2) Web Push (sending server-side notifications)
- A Netlify Function `netlify/functions/sendTestNotification.js` is provided to send a test notification using Firebase Admin SDK.
- For it to work, set the following environment variable with the JSON service account (stringified):
  - SERVICE_ACCOUNT_JSON
- Optionally set FCM_PROJECT_ID but the service account typically includes the project.
- Example POST to the function (replace <site> and <token>):
  POST https://<site>/.netlify/functions/sendTestNotification
  Content-Type: application/json
  Body: { "token": "<token>", "title": "Hello", "body": "Test push" }

3) VAPID key for client
- Ensure `VITE_FIREBASE_VAPID_KEY` is set in Netlify environment; client code reads this to call `getToken`.

4) iOS notes
- iOS requires the user to Add to Home Screen (A2HS) for web push to work in Safari (iOS 16.4+). The app shows a small hint for iOS Safari users.

5) Security
- Keep `SERVICE_ACCOUNT_JSON` secret. Netlify environment variables are secure.
