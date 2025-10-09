# TALC Project Documentation

## Table of Contents
- [Project Overview](#project-overview)
- [Setup & Deployment](#setup--deployment)
- [Notifications & PWA](#notifications--pwa)
- [Mobile & UI Optimizations](#mobile--ui-optimizations)
- [Coordinator Role & Schema](#coordinator-role--schema)
- [Mentors Page Improvements](#mentors-page-improvements)
- [SOP Manager Mobile UI](#sop-manager-mobile-ui)
- [Notification Reminder System](#notification-reminder-system)
- [Android Notification Testing](#android-notification-testing)

---

## Project Overview

A web application for managing KPIs, events, SOPs, mentors, and operational metrics for TALC centers. Built with React, Material-UI, and Firebase.

### Features
- Authentication (Google Sign-in)
- User, profile, and role management
- Calendar/event/task management
- Mentor and SOP management
- Operational dashboards and KPI visualizations
- Push notifications (FCM)
- PWA support (offline, installable)

---

## Setup & Deployment

1. **Clone & Install**
   ```bash
   git clone <repository-url>
   cd talc-management
   npm install
   ```
2. **Configure Firebase**
   - Create a Firebase project
   - Enable Google Auth, Firestore, FCM
   - Update `src/firebase/config.js` and `.env` with credentials and VAPID key
3. **Run Locally**
   ```bash
   npm run dev
   ```
4. **Build for Production**
   ```bash
   npm run build
   ```
5. **Deploy**
   - Netlify (recommended): uses `netlify.toml` and `netlify/functions/`
   - Firebase Functions: deploy from `functions/` folder

---

## Notifications & PWA

- Uses Firebase Cloud Messaging for push notifications
- Service worker: `public/firebase-messaging-sw.js`, `src/service-worker.js`
- PWA install prompts and status in Profile page
- Notification enablement: smart prompts, role-based reminders, persistent settings
- See [Notification Reminder System](#notification-reminder-system) for details

---

## Mobile & UI Optimizations

- Enhanced touch targets, spacing, and typography for mobile
- Responsive layouts for all major pages
- Hardware acceleration, lazy loading, and bundle size optimizations
- PWA manifest and meta tags for Android/iOS
- See [Mobile Experience Enhancements](#mobile--ui-optimizations) for details

---

## Coordinator Role & Schema

- New `Coordinator` role added to user schema
- Role permissions matrix and navigation access detailed
- No structural DB changes needed; update user roles as needed
- See [Coordinator Role Implementation](#coordinator-role--schema)

---

## Mentors Page Improvements

- Mobile-first card layout, larger avatars, better touch targets
- Clear evaluator and form status display
- Action bar with Evaluate, Edit, Delete (smaller icons)
- Responsive typography and spacing
- See [Mentors Page Mobile UI Improvements](#mentors-page-improvements)

---

## SOP Manager Mobile UI

- Responsive design for SOP Manager page
- Improved readability, touch targets, dialogs, and grid layout
- Accessibility and performance improvements
- See [SOP Manager Mobile UI Improvements](#sop-manager-mobile-ui)

---

## Notification Reminder System

- Proactive, role-based notification enablement prompts
- Smart timing, multi-level guidance, persistent settings
- Fallbacks for denied permissions and browser support
- See [Notification Reminder System](#notification-reminder-system)

---

## Android Notification Testing

- Steps to ensure system notifications (not in-browser popups)
- Service worker registration, permission, and foreground/background message handling
- Troubleshooting and expected behaviors
- See [Android Notification Testing Guide](#android-notification-testing)

---

## For More Details
- See original markdown files in the repo for full guides and change logs.
