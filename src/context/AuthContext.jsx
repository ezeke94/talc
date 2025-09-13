import React, { createContext, useState, useEffect, useContext } from 'react';
import { auth, db, persistencePromise } from '../firebase/config';
import { onAuthStateChanged, getRedirectResult } from 'firebase/auth';
import { CircularProgress, Box } from '@mui/material';
// notifications removed
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const AuthContext = createContext({ currentUser: null, loading: true });

export const useAuth = () => {
    return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [authInitialized, setAuthInitialized] = useState(false);

    useEffect(() => {
        let unsubscribe = () => {};
        let authStateTimeout;

        const init = async () => {
            // Ensure auth persistence has been configured before handling redirect or subscribing.
            try {
                await (persistencePromise || Promise.resolve());
            } catch (e) {
                // If persistence setup failed, continue anyway.
                console.debug('Auth persistence setup failed or was skipped:', e?.message || e);
            }

            // Keep loading true while we check for any redirect sign-in results
            try {
                const redirectResult = await getRedirectResult(auth);
                if (redirectResult?.user) {
                    console.debug('Redirect sign-in successful:', redirectResult.user.email);
                }
            } catch (e) {
                // No redirect result or failure is okay — continue
                console.debug('No redirect result or redirect processing failed:', e?.message || e);
            }

            // Log the current URL to confirm OAuth redirect parameters are received
            console.debug('Current URL:', window.location.href);

            // Ensure auth persistence is configured for standalone PWA mode
            const isStandalone = () => {
                try {
                    return (
                        window.navigator.standalone ||
                        window.matchMedia('(display-mode: standalone)').matches ||
                        window.location.search.includes('utm_source=homescreen') ||
                        document.referrer === "" ||
                        document.referrer.includes("android-app://")
                    );
                } catch (e) {
                    return false;
                }
            };

            if (isStandalone()) {
                console.debug('App is running in standalone mode.');
            } else {
                console.debug('App is running in browser mode.');
            }

            // Set a timeout to prevent infinite loading in case Firebase auth doesn't respond
            authStateTimeout = setTimeout(() => {
                if (!authInitialized) {
                    console.warn('Auth state timeout - Firebase auth may be stuck');
                    setLoading(false);
                    setAuthInitialized(true);
                }
            }, 10000); // 10 second timeout

            // Now subscribe to auth state changes
            unsubscribe = onAuthStateChanged(auth, async (user) => {
                // Clear timeout since we got a response
                if (authStateTimeout) {
                    clearTimeout(authStateTimeout);
                    authStateTimeout = null;
                }

                setAuthInitialized(true);

                // Start processing this change
                if (user) {
                    // Expose Firebase user immediately so routes can proceed
                    setCurrentUser(prev => prev || user);
                    // Stop blocking UI immediately; profile sync continues in background
                    setLoading(false);

                    // notifications removed
                    try {
                        const userRef = doc(db, 'users', user.uid);
                        const snap = await getDoc(userRef);
                        const base = {
                            uid: user.uid,
                            email: user.email || '',
                            name: user.displayName || '',
                            displayName: user.displayName || '',
                            photoURL: user.photoURL || '',
                            lastLoginAt: serverTimestamp(),
                        };
                        console.log('AuthContext: Firestore user doc data:', snap.exists() ? snap.data() : null);
                        if (snap.exists()) {
                            // Merge fresh auth data without clobbering role/centers
                            await setDoc(userRef, base, { merge: true });
                            // Merge Firestore profile fields into currentUser
                            setCurrentUser(current => {
                                const merged = { ...user, ...snap.data() };
                                console.log('AuthContext: Merged currentUser:', merged);
                                return merged;
                            });
                        } else {
                            await setDoc(userRef, {
                                ...base,
                                isActive: false, // Set inactive by default
                                role: 'Evaluator',
                                assignedCenters: [],
                                createdAt: serverTimestamp(),
                            }, { merge: true });
                            const merged = { ...user, ...base, role: 'Evaluator', isActive: false, assignedCenters: [] };
                            console.log('AuthContext: Created new user doc, currentUser:', merged);
                            setCurrentUser(merged);
                        }
                    } catch (e) {
                        console.error('Failed to upsert user profile', e);
                        setCurrentUser(user);
                    } finally {
                        // Ensure we are not stuck in loading if any of the above throws
                        setLoading(false);
                    }
                } else {
                    setCurrentUser(null);
                    setLoading(false);
                }
            });
        };

        // PWA event handlers for better auth state management
        const handlePWAAppVisible = () => {
            console.debug('AuthContext: PWA app became visible, checking auth state');
            // Force a auth state check when PWA becomes visible
            if (auth.currentUser && !currentUser) {
                console.debug('AuthContext: Found Firebase user but no context user, syncing');
                setCurrentUser(auth.currentUser);
                setLoading(false);
            }
        };

        const handlePWAAuthError = (event) => {
            console.warn('AuthContext: PWA auth error detected:', event.detail?.error);
            // Reset auth state on critical errors
            if (event.detail?.error?.code === 'auth/web-storage-unsupported' ||
                event.detail?.error?.code === 'auth/network-request-failed') {
                setCurrentUser(null);
                setLoading(false);
            }
        };

        // Add PWA event listeners
        window.addEventListener('pwa-app-visible', handlePWAAppVisible);
        window.addEventListener('pwa-auth-error', handlePWAAuthError);
        window.addEventListener('pwa-auth-promise-error', handlePWAAuthError);

        init();

        return () => {
            if (authStateTimeout) {
                clearTimeout(authStateTimeout);
            }
            try {
                if (typeof unsubscribe === 'function') unsubscribe();
            } catch (e) {
                /* ignore */
            }
            
            // Clean up PWA event listeners
            window.removeEventListener('pwa-app-visible', handlePWAAppVisible);
            window.removeEventListener('pwa-auth-error', handlePWAAuthError);
            window.removeEventListener('pwa-auth-promise-error', handlePWAAuthError);
        };
    }, []);

    return (
        <AuthContext.Provider value={{ currentUser, loading }}>
            {loading ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', gap: 2 }}>
                    <CircularProgress />
                    <Box sx={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '14px', color: '#666' }}>Loading...</div>
                        {!authInitialized && (
                            <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                                Initializing authentication
                            </div>
                        )}
                    </Box>
                </Box>
            ) : children}
        </AuthContext.Provider>
    );
};