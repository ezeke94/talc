import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import InactiveAccount from '../pages/InactiveAccount';

const ProtectedRoute = ({ children }) => {
    const { currentUser } = useAuth();
    if (!currentUser) {
        return <Navigate to="/login" />;
    }
    // If the account is present but marked inactive, show the inactive page
    if (currentUser && currentUser.isActive === false) {
        return <InactiveAccount />;
    }
    return children;
};

export default ProtectedRoute;