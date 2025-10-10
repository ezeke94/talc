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
    const [showRedirectHint, setShowRedirectHint] = useState(false);

    const isInAppBrowser = () => {
        try {
            const ua = navigator.userAgent || '';
            // Common in-app browsers: Facebook, Instagram, Twitter, TikTok, Line
            return /(FBAN|FB_IAB|FBAV|Instagram|Twitter|Line|MiuiBrowser|DuckDuckGo)/i.test(ua);
        } catch {
            return false;
        }
    };

    useEffect(() => {
        // If a user is signed in, navigate to the app; ProtectedRoute will handle inactive accounts.
        // Add additional checks to prevent redirect loops in PWA mode
        if (currentUser && currentUser.uid && !loading) {
            // Small delay to ensure auth state is stable
            const timer = setTimeout(() => {
                navigate('/', { replace: true });
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [currentUser, navigate, loading]);

    // Surface redirect errors captured by AuthContext
    useEffect(() => {
        try {
            const redirectErr = sessionStorage.getItem('authRedirectError');
            if (redirectErr) {
                console.warn('Login: Found redirect error from previous attempt:', redirectErr);
                setError('Sign-in via redirect failed. Please try again, or allow popups and retry.');
                sessionStorage.removeItem('authRedirectError');
                setShowRedirectHint(true);
            }
        } catch {}
    }, []);

    // Detect true standalone PWA mode only (avoid referrer-based false positives)
    const isStandalonePWA = () => {
        try {
            const isiOSStandalone = typeof window !== 'undefined' && !!window.navigator?.standalone; // iOS only
            const displayStandalone = typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)')?.matches;
            return isiOSStandalone || displayStandalone;
        } catch (e) {
            return false;
        }
    };

    const handleGoogleSignIn = async () => {
        try {
            setError(null);
            setSigningIn(true);
            
            const params = new URLSearchParams(window.location.search);
            const authModeOverride = params.get('authMode'); // 'popup' | 'redirect' | null
            console.log('Login: Starting sign-in process', { isStandalone: isStandalonePWA(), authModeOverride });
            
            // Use redirect only in true standalone PWA mode (popups often blocked)
            if (authModeOverride === 'redirect' || (authModeOverride !== 'popup' && isStandalonePWA())) {
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
                    console.warn('Login: Popup returned no user; falling back to redirect');
                    await signInWithRedirect(auth, googleProvider);
                    return;
                } catch (popupError) {
                    console.warn('Login: Popup sign-in failed:', popupError?.code, popupError);
                    // Fallback to redirect for most errors except explicit user-cancel
                    if (popupError?.code !== 'auth/popup-closed-by-user' && popupError?.code !== 'auth/cancelled-popup-request') {
                        console.log('Login: Using redirect fallback after popup error');
                        await signInWithRedirect(auth, googleProvider);
                        return;
                    }
                    // If user closed the popup, surface a friendly message
                    setError('Sign-in popup was closed. Please try again.');
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
            if (!isStandalonePWA()) {
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
                    {showRedirectHint && (
                        <Button
                            fullWidth
                            variant="text"
                            onClick={() => {
                                try {
                                    setSigningIn(true);
                                    setError(null);
                                    // Force redirect mode explicitly
                                    signInWithRedirect(auth, googleProvider);
                                } catch (e) {
                                    setSigningIn(false);
                                    setError('Redirect sign-in could not start. Please try again.');
                                }
                            }}
                            sx={{ mt: 1 }}
                        >
                            Having trouble? Try redirect sign-in
                        </Button>
                    )}
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
                    {isInAppBrowser() && (
                        <Alert severity="info" sx={{ mt: 2 }}>
                            It looks like you are using an in‑app browser. If sign‑in doesn’t complete, open this page in your default browser (Safari/Chrome) and try again.
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