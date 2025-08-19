# TALC Management Application


A web application for managing KPIs, events, SOPs, mentors, and operational metrics for TALC centers. Built with React, Material-UI, and Firebase.


## Features

- **Authentication**: Secure Google Sign-in
- **User Management**: Role assignment, center assignment, activation/deactivation
- **Profile Management**: Edit name, assigned centers, view privacy/terms
- **Calendar/Event Management**: Create, edit, reschedule, delete events/tasks; recurring events; to-do lists; SOP application; PDF export
- **Mentor Management**: Add/Edit/Delete mentors, assign centers
- **SOP Management**: Admin/Quality can create/edit global SOPs
- **Operational Dashboard**: Center effectiveness, deadline metrics
- **Notifications**: Push notifications for upcoming events/tasks and reschedules (FCM)
- **PWA Support**: Offline access, installable on mobile


## Tech Stack

- React 19
- Material-UI v7
- Firebase (Authentication, Firestore, Cloud Messaging)
- Recharts for data visualization
- Vite for build tooling
- jsPDF for PDF export


## Getting Started

1. Clone the repository
```bash
git clone [repository-url]
cd talc-management
```

2. Install dependencies
```bash
npm install
```

3. Configure Firebase
  - Create a Firebase project
  - Enable Google Authentication
  - Enable Firestore database
  - Enable Firebase Cloud Messaging (FCM)
  - Update `src/firebase/config.js` with your Firebase credentials
  - Add your VAPID key for FCM to `.env` as `VITE_FIREBASE_VAPID_KEY`

4. Run the development server
```bash
npm run dev
```

5. Build for production
```bash
npm run build
```


## Project Structure

```
src/
├── components/     # Reusable UI components
├── context/        # React context providers
├── firebase/       # Firebase configuration
├── pages/          # Main application pages
├── utils/          # Utility functions and data
└── service-worker.js # PWA service worker
```


## Notifications Setup

- Users are prompted to allow notifications on login/profile.
- FCM tokens are saved to the `users` collection (`notificationTokens`).
- Service worker handles push notifications for events/tasks.

## Schema Documentation

- See `firebase-schema.md` for all collections and fields, including notification support.


## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
