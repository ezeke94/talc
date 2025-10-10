import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, googleProvider } from '../firebase/config';
import { signInWithPopup, signInWithRedirect } from 'firebase/auth';
import { Button, Container, Typography, Paper, Box, CircularProgress, Alert } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import logo from '../assets/logo.png'; // <-- Import your logo
import { useAuth } from '../context/AuthContext';
import { isPWA as isPWAEnv } from '../utils/pwaUtils';

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
        } catch (e) {
            console.warn('Login: Failed to check in-app browser:', e);
            return false;
        }
    };

    useEffect(() => {
        // If a user is signed in, navigate to the app; ProtectedRoute will handle inactive accounts.
        if (currentUser && currentUser.uid) {
            navigate('/');
        }
    }, [currentUser, navigate]);

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
        } catch (e) {
            console.warn('Login: Failed to check redirect error:', e);
        }
    }, []);

    // Unified PWA detection (supports Windows/Android/iOS installed apps)
    const isStandalonePWA = () => {
        const result = !!isPWAEnv();
        console.log('Login: isStandalonePWA check:', result, {
            navigatorStandalone: !!window.navigator?.standalone,
            displayStandalone: window.matchMedia?.('(display-mode: standalone)')?.matches,
            displayWCO: window.matchMedia?.('(display-mode: window-controls-overlay)')?.matches,
            utmSource: window.location.search.includes('utm_source=homescreen'),
            referrer: document.referrer === "" || document.referrer.includes("android-app://")
        });
        return result;
    };

    const handleGoogleSignIn = async () => {
        try {
            setError(null);
            setSigningIn(true);
            
            console.log('Login: Starting sign-in process');
            
            // CRITICAL: Ensure persistence is set BEFORE attempting sign-in
            // This is especially important for PWAs where the auth state must survive page reloads
            const { persistencePromise } = await import('../firebase/config');
            try {
                const persistenceType = await persistencePromise;
                console.log('Login: Auth persistence configured:', persistenceType);
            } catch (persistErr) {
                console.warn('Login: Persistence setup issue (non-fatal):', persistErr);
            }
            
            const params = new URLSearchParams(window.location.search);
            const authModeOverride = params.get('authMode'); // 'popup' | 'redirect' | null
            console.log('Login: Auth mode override:', authModeOverride);
            console.log('Login: Current URL:', window.location.href);
            console.log('Login: Is PWA:', isStandalonePWA());
            
            // Use redirect only in true standalone PWA mode (popups often blocked)
            // TEMP: Force popup mode until redirect URI is configured in Google Cloud Console
            if (false && (authModeOverride === 'redirect' || (authModeOverride !== 'popup' && isStandalonePWA()))) {
                console.log('Login: Using redirect sign-in');
                await signInWithRedirect(auth, googleProvider);
                // redirect will take over; navigation happens after redirect completes
            } else {
                console.log('Login: Using popup sign-in (forced for compatibility)');
                try {
                    const result = await signInWithPopup(auth, googleProvider);
                    if (result?.user) {
                        console.log('Login: Popup sign-in successful for user:', result.user.email);
                        // Navigate immediately after popup success to avoid waiting on background profile sync
                        navigate('/');
                        return;
                    }
                    console.warn('Login: Popup returned no user; this should not happen');
                } catch (popupError) {
                    console.warn('Login: Popup sign-in failed:', popupError?.code, popupError?.message);
                    // If popup fails, show error
                    setError('Sign-in failed. Please try again.');
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
                    {import.meta.env?.DEV && (
                        <Alert severity="info" sx={{ mt: 2 }}>
                            Debug: Login is currently using popup mode. For PWA redirect mode, configure the redirect URI in Google Cloud Console.
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