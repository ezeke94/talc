import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, googleProvider } from '../firebase/config';
import { signInWithPopup, signInWithRedirect } from 'firebase/auth';
import { Button, Container, Typography, Paper, Box, CircularProgress } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import logo from '../assets/logo.png'; // <-- Import your logo
import { useAuth } from '../context/AuthContext';

const Login = () => {
    const navigate = useNavigate();
    const { currentUser, loading } = useAuth();
    const [signingIn, setSigningIn] = useState(false);

    useEffect(() => {
        if (!loading && currentUser) {
            navigate('/');
        }
    }, [currentUser, loading, navigate]);

    // Detect iOS standalone (app added to home screen) where popups are blocked
    const isIOSStandalone = () => {
        try {
            // navigator.standalone is true for iOS home-screen webapps
            // For modern browsers, match display-mode media as an additional check
            return (window.navigator && window.navigator.standalone) || window.matchMedia('(display-mode: standalone)').matches;
        } catch (e) {
            return false;
        }
    };

    const handleGoogleSignIn = async () => {
        try {
            setSigningIn(true);
            // Use redirect on iOS standalone or when popups are likely blocked
            if (isIOSStandalone()) {
                await signInWithRedirect(auth, googleProvider);
                // redirect will take over; navigation happens after redirect completes
            } else {
                await signInWithPopup(auth, googleProvider);
                navigate('/');
            }
        } catch (error) {
            console.error('Popup sign-in failed, falling back to redirect:', error);
            try {
                await signInWithRedirect(auth, googleProvider);
            } catch (e) {
                console.error('Redirect sign-in also failed:', e);
            }
        } finally {
            setSigningIn(false);
        }
    };

    // Keep login screen visible; if already authenticated, use effect redirects.

    return (
        <Container component="main" maxWidth="xs">
            <Paper elevation={3} sx={{ marginTop: 8, padding: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {/* --- Logo added here --- */}
                <Box 
                    component="img"
                    src={logo}
                    alt="App Logo"
                    sx={{ height: 60, mb: 3 }}
                />
                <Typography component="h1" variant="h5" sx={{ mb: 1 }}>
                    TALC Management Login
                </Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>
                    <a href="https://www.talcworld.com" target="_blank" rel="noopener noreferrer" style={{ color: '#5040cd', textDecoration: 'underline' }}>
                        Visit TALC Website
                    </a>
                </Typography>
                <Box sx={{ mt: 3, width: '100%' }}>
                    <Button
                        fullWidth
                        variant="contained"
                        startIcon={<GoogleIcon />}
                        onClick={handleGoogleSignIn}
                        size="large"
                    >
                        Sign In with Google
                    </Button>
                </Box>
                <Box sx={{ mt: 4, width: '100%', textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                        <a href="/privacy-policy" style={{ color: '#5040cd', textDecoration: 'underline', marginRight: 16 }}>Privacy Policy</a>
                        <a href="/terms-of-use" style={{ color: '#5040cd', textDecoration: 'underline' }}>Terms of Use</a>
                    </Typography>
                </Box>
            </Paper>
        </Container>
    );
};

export default Login;