import UserProfile from './pages/UserProfile';
import UserManagement from './pages/UserManagement';
import SOPManager from './pages/SOPManager';
import OperationalDashboard from './pages/OperationalDashboard';
import Projects from './pages/Projects';
import Boards from './pages/Boards';
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Mentors from './pages/Mentors';
import MentorDetail from './pages/MentorDetail';
import SeedData from './pages/SeedData';
import IntellectKPIForm from './components/IntellectKPIForm';
import CulturalKPIForm from './components/CulturalKPIForm';
import DynamicKPIForm from './components/DynamicKPIForm';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfUse from './pages/TermsOfUse';
import Calendar from './pages/Calendar';
import FormManagement from './pages/FormManagement';
import NotificationDebugToast from './components/NotificationDebugToast';
// ...existing code...

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <NotificationDebugToast />
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
                        <Route path="profile" element={<UserProfile />} />
                        <Route path="mentor/:mentorId" element={<MentorDetail />} />
                        <Route path="mentor/:mentorId/fill-intellect-kpi" element={<IntellectKPIForm />} />
                        <Route path="mentor/:mentorId/fill-cultural-kpi" element={<CulturalKPIForm />} />
                        <Route path="mentor/:mentorId/fill/:formId" element={<DynamicKPIForm />} />
                        <Route path="seed-data" element={<SeedData />} />
                    </Route>
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;