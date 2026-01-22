import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import { Box, CircularProgress } from '@mui/material';

const UserProfile = lazy(() => import('./pages/UserProfile'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const SOPManager = lazy(() => import('./pages/SOPManager'));
const OperationalDashboard = lazy(() => import('./pages/OperationalDashboard'));
const Projects = lazy(() => import('./pages/Projects'));
const Boards = lazy(() => import('./pages/Boards'));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Mentors = lazy(() => import('./pages/Mentors'));
const MentorDetail = lazy(() => import('./pages/MentorDetail'));
const SeedData = lazy(() => import('./pages/SeedData'));
const IntellectKPIForm = lazy(() => import('./components/IntellectKPIForm'));
const CulturalKPIForm = lazy(() => import('./components/CulturalKPIForm'));
const DynamicKPIForm = lazy(() => import('./components/DynamicKPIForm'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfUse = lazy(() => import('./pages/TermsOfUse'));
const Calendar = lazy(() => import('./pages/Calendar'));
const FormManagement = lazy(() => import('./pages/FormManagement'));
const MentorStatusAdmin = lazy(() => import('./pages/MentorStatusAdmin'));
const ReportDownload = lazy(() => import('./pages/ReportDownload'));

const RouteLoadingFallback = () => (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
    </Box>
);

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Suspense fallback={<RouteLoadingFallback />}>
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                        <Route path="/terms-of-use" element={<TermsOfUse />} />
                        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                            <Route index element={<Calendar />} />
                            <Route path="mentors" element={<Mentors />} />
                            <Route path="calendar" element={<Calendar />} />
                            <Route path="boards" element={<Boards />} />
                            <Route path="projects" element={<Projects />} />
                            <Route path="kpi-dashboard" element={<Dashboard />} />
                            <Route path="operational-dashboard" element={<OperationalDashboard />} />
                            <Route path="sop-management" element={<SOPManager />} />
                            <Route path="form-management" element={<FormManagement />} />
                            <Route path="user-management" element={<UserManagement />} />
                            <Route path="mentor-status" element={<MentorStatusAdmin />} />
                            <Route path="reports" element={<ReportDownload />} />
                            <Route path="profile" element={<UserProfile />} />
                            <Route path="mentor/:mentorId" element={<MentorDetail />} />
                            <Route path="mentor/:mentorId/fill-intellect-kpi" element={<IntellectKPIForm />} />
                            <Route path="mentor/:mentorId/fill-cultural-kpi" element={<CulturalKPIForm />} />
                            <Route path="mentor/:mentorId/fill/:formId" element={<DynamicKPIForm />} />
                            <Route path="seed-data" element={<SeedData />} />
                        </Route>
                    </Routes>
                </Suspense>
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;