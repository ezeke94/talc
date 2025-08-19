// Scripts for firebase and firebase messaging
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

importScripts('./firebase-config.js');

// Initialize the Firebase app in the service worker
// "Default" Firebase configuration (prevents errors)
if (typeof firebaseConfig !== 'undefined') {
  firebase.initializeApp(firebaseConfig);
} else {
    console.error("firebaseConfig is not defined. Make sure firebase-config.js is loaded correctly.");
}


// Retrieve an instance of Firebase Messaging so that it can handle background messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('Received background message ', payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
  };

  self.registration.showNotification(notificationTitle,
    notificationOptions);
});
