import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, googleProvider } from '../firebase/config';
import { signInWithPopup, signInWithRedirect } from 'firebase/auth';
import { Button, Container, Typography, Paper, Box, CircularProgress, Alert } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import logo from '../assets/logo.png'; // <-- Import your logo
import { useAuth } from '../context/AuthContext';

const Login = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [signingIn, setSigningIn] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        // If a user is signed in, navigate to the app; ProtectedRoute will handle inactive accounts.
        if (currentUser && currentUser.uid) {
            navigate('/');
        }
    }, [currentUser, navigate]);

    // Detect iOS standalone (app added to home screen) where popups are blocked
    const isIOSStandalone = () => {
        try {
            // navigator.standalone is true for iOS home-screen webapps
            // For modern browsers, match display-mode media as an additional check
            return (
                (window.navigator && window.navigator.standalone) || 
                window.matchMedia('(display-mode: standalone)').matches ||
                window.location.search.includes('utm_source=homescreen') ||
                document.referrer === "" ||
                document.referrer.includes("android-app://")
            );
        } catch (e) {
            return false;
        }
    };

    const handleGoogleSignIn = async () => {
        try {
            setError(null);
            setSigningIn(true);
            
            console.log('Login: Starting sign-in process', { isStandalone: isIOSStandalone() });
            
            // Use redirect on iOS standalone or when popups are likely blocked
            if (isIOSStandalone()) {
                console.log('Login: Using redirect sign-in for standalone mode');
                await signInWithRedirect(auth, googleProvider);
                // redirect will take over; navigation happens after redirect completes
            } else {
                console.log('Login: Attempting popup sign-in for browser mode');
                try {
                    const result = await signInWithPopup(auth, googleProvider);
                    if (result?.user) {
                        console.log('Login: Popup sign-in successful');
                        // Navigate immediately after popup success to avoid waiting on background profile sync
                        navigate('/');
                        return;
                    }
                } catch (popupError) {
                    console.warn('Login: Popup sign-in failed, trying redirect fallback:', popupError);
                    
                    if (popupError.code === 'auth/popup-blocked' || 
                        popupError.code === 'auth/popup-closed-by-user' ||
                        popupError.code === 'auth/cancelled-popup-request') {
                        console.log('Login: Using redirect fallback due to popup issues');
                        await signInWithRedirect(auth, googleProvider);
                        return;
                    }
                    throw popupError;
                }
            }
        } catch (err) {
            console.error('Login: Sign-in error:', err);
            let errorMessage = 'Sign-in failed. Please try again.';
            
            if (err.code === 'auth/network-request-failed') {
                errorMessage = 'Network error. Please check your connection and try again.';
            } else if (err.code === 'auth/popup-blocked') {
                errorMessage = 'Popup was blocked. Please allow popups and try again.';
            } else if (err.code === 'auth/web-storage-unsupported') {
                errorMessage = 'Web storage is not supported. Please enable cookies and local storage.';
            } else if (err.message) {
                errorMessage = err.message;
            }
            
            setError(errorMessage);
        } finally {
            // Only set loading to false if we're not doing a redirect
            if (!isIOSStandalone()) {
                setSigningIn(false);
            }
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
                    decoding="async"
                    loading="lazy"
                    sx={{ height: 60, mb: 3 }}
                />
                <Typography component="h1" variant="h5" sx={{ mb: 1 }}>
                    TALC Management Login
                </Typography>
                <Box sx={{ mt: 3, width: '100%' }}>
                    <Button
                        fullWidth
                        variant="contained"
                        startIcon={<GoogleIcon />}
                        aria-label="Sign in with Google"
                        onClick={handleGoogleSignIn}
                        disabled={signingIn}
                        size="large"
                    >
                        Sign In with Google
                    </Button>
                    {signingIn && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                            <CircularProgress size={20} />
                        </Box>
                    )}
                    {error && (
                        <Alert severity="error" sx={{ mt: 2 }}>
                            {error}
                        </Alert>
                    )}
                    {/* Show pending approval message if user is logged in but inactive */}
                    {currentUser && currentUser.uid && !currentUser.isActive && (
                        <Alert severity="info" sx={{ mt: 2 }}>
                            Your account is pending admin approval. Please wait for activation.
                        </Alert>
                    )}
                </Box>
                <Box sx={{ mt: 4, width: '100%', textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                        <a href="/privacy-policy" style={{ color: '#5040cd', textDecoration: 'underline', marginRight: 16 }}>Privacy Policy</a>
                        <a href="/terms-of-use" style={{ color: '#5040cd', textDecoration: 'underline' }}>Terms of Use</a>
                    </Typography>
                    <Typography variant="body2">
                        Website: {' '}
                        <a
                            href="https://www.talcworld.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#5040cd', textDecoration: 'underline' }}
                        >
                            www.talcworld.com
                        </a>
                    </Typography>
                </Box>
            </Paper>
        </Container>
    );
};

export default Login;