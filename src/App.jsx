import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Mentors from './pages/Mentors';
import MentorDetail from './pages/MentorDetail';
import IntellectKPIForm from './components/IntellectKPIForm';
import CulturalKPIForm from './components/CulturalKPIForm';

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                        <Route index element={<Dashboard />} />
                        <Route path="mentors" element={<Mentors />} />
                        <Route path="mentor/:mentorId" element={<MentorDetail />} />
                        <Route path="mentor/:mentorId/fill-intellect-kpi" element={<IntellectKPIForm />} />
                        <Route path="mentor/:mentorId/fill-cultural-kpi" element={<CulturalKPIForm />} />
                    </Route>
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;