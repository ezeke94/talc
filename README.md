# KPI Tracker Application

A web application for tracking and managing Key Performance Indicators (KPIs) for mentors. Built with React, Material-UI, and Firebase.

## Features

- **Authentication**: Secure Google Sign-in
- **Dashboard**: Visual representation of mentor performance distributions
- **KPI Management**: 
  - Intellect KPI tracking
  - Cultural KPI tracking
- **Mentor Management**:
  - Add/Edit/Delete mentors
  - View mentor details and history
- **Data Visualization**: Interactive charts showing KPI distributions
- **Center-based Filtering**: Filter data by different centers

## Tech Stack

- React 19
- Material-UI v7
- Firebase (Authentication & Firestore)
- Recharts for data visualization
- Vite for build tooling

## Getting Started

1. Clone the repository
```bash
git clone [repository-url]
cd kpi-app
```

2. Install dependencies
```bash
npm install
```

3. Configure Firebase
- Create a Firebase project
- Enable Google Authentication
- Create a Firestore database
- Update `src/firebase/config.js` with your Firebase credentials

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
├── context/       # React context providers
├── firebase/      # Firebase configuration
├── pages/         # Main application pages
└── utils/         # Utility functions and data
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
