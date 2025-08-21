import React from 'react';
import { Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import InactiveAccount from '../pages/InactiveAccount';

const ProtectedRoute = ({ children }) => {
    const { currentUser, loading } = useAuth();
    // While auth is initializing, show a small loader to avoid a blank screen
    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
                <CircularProgress size={32} />
            </Box>
        );
    }
    if (!currentUser) {
        return <Navigate to="/login" replace />;
    }
    // If the account is present but marked inactive, show the inactive page
    if (currentUser && currentUser.isActive === false) {
        return <InactiveAccount />;
    }
    return children;
};

export default ProtectedRoute;