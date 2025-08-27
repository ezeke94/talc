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
# TALC Management Application

A web application for managing KPIs, events, SOPs, mentors, and operational metrics for TALC centers. Built with React, Material UI and Firebase. This README explains how to run, build and deploy the project locally and what environment variables you need to provide.

## Features

- Authentication (Google Sign-in)
- User and profile management (roles, center assignment)
- Calendar and event/task management (recurring events, reschedules, to-dos)
- Mentors and SOP management
- Operational dashboards and KPI visualizations
- Push notifications via Firebase Cloud Messaging (FCM)
- PWA support (service worker, installable)

## Tech stack

- React 19 (Vite)
- Material UI v7
- Firebase (Auth, Firestore, Cloud Messaging)
- Recharts (charts)
- jsPDF (PDF export)
- Vite (dev server & build)

## Quick start

Requirements

- Node.js (recommended 18+)
- npm or yarn

Local setup

1) Clone

  git clone <repository-url>
  cd talc-management

2) Install dependencies

  npm install

3) Environment variables

Create a `.env` file in the project root (Vite only exposes vars prefixed with `VITE_`). At minimum provide your Firebase config and the FCM VAPID key. Example `.env` (do NOT commit this file):

```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-auth-domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_VAPID_KEY=your_fcm_vapid_key
```

You can still use `src/firebase/config.js` to initialize Firebase; the app reads values from `import.meta.env` (Vite) where appropriate.

4) Run development server

  npm run dev

5) Build for production

  npm run build

6) Preview the production build locally

  npm run preview

Available npm scripts (from `package.json`)

- `dev` — start Vite dev server
- `build` — build production bundle
- `preview` — preview built bundle
- `lint` — run ESLint (if configured locally)

## Notifications & PWA notes

- The app uses Firebase Cloud Messaging for push notifications. When users opt-in, FCM tokens are saved to the `users` collection (see `utils/notifications.js`).
- The service worker for push handling and offline support lives in `public/firebase-messaging-sw.js` and `src/service-worker.js` (see `public/` and `src/`).
- Make sure to provide the `VITE_FIREBASE_VAPID_KEY` value for FCM to register properly on the client.

## Deployment

Netlify (recommended for frontend)

- This repo includes `netlify.toml` and a `netlify/functions/` folder for serverless endpoints. Netlify will run the build and serve the static assets. Configure environment variables in the Netlify site UI.
- If you use Netlify Functions, place serverless functions in `netlify/functions/` (already present) or configure a separate functions build.

Firebase Functions

- There is also a `functions/` folder containing Cloud Functions (Node). Deploy them with the Firebase CLI if needed. Keep their own `package.json` and follow Firebase deployment docs.

Other hosts

- You can deploy the `dist/` output produced by `npm run build` to any static host (Vercel, Surge, S3+CloudFront, etc.).

## Project structure (important files)

```
public/                 # static assets, service worker, manifest
src/                    # application source
  ├─ components/        # UI components
  ├─ context/           # React context providers
  ├─ firebase/          # firebase configuration helpers
  ├─ pages/             # route views
  └─ service-worker.js  # PWA service worker entry
functions/              # Firebase Cloud Functions (server)
netlify/functions/      # Netlify serverless functions
package.json            # scripts and dependencies
netlify.toml            # netlify deploy config
```

## Schema

See `firebase-schema.md` for Firestore collections, document shapes, and indices.

## Testing and linting

- Lint: `npm run lint` (requires eslint dependencies installed)
- There are no automated tests included; consider adding Jest/React Testing Library for unit and integration tests.

## Contributing

1. Fork the repository
2. Create a branch: `git checkout -b feature/your-feature`
3. Commit your changes with a clear message
4. Push and open a Pull Request

When contributing:

- Keep UI and accessibility in mind
- Add unit tests for new business logic
- Update the README or `firebase-schema.md` if you change data shapes or env variables

## Troubleshooting

- If Firebase errors occur on startup, double-check your `.env` values and `src/firebase/config.js` initialization.
- If notifications fail to register, verify your VAPID key and that the service worker is accessible at the root (`/firebase-messaging-sw.js` in `public/`).

## License

MIT — see the `LICENSE` file for details.

## Contact

If you need help, open an issue in this repository describing the problem and environment.
