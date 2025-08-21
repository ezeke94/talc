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

    useEffect(() => {
        let unsubscribe = () => {};

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
                await getRedirectResult(auth);
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
                        window.matchMedia('(display-mode: standalone)').matches
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

            // Now subscribe to auth state changes
            unsubscribe = onAuthStateChanged(auth, async (user) => {
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
                        if (snap.exists()) {
                            // Merge fresh auth data without clobbering role/centers
                            await setDoc(userRef, base, { merge: true });
                            // Merge Firestore profile fields into currentUser
                            setCurrentUser({ ...user, ...snap.data() });
                        } else {
                            await setDoc(userRef, {
                                ...base,
                                isActive: true,
                                role: 'Evaluator',
                                assignedCenters: [],
                                createdAt: serverTimestamp(),
                            }, { merge: true });
                            setCurrentUser({ ...user, ...base, role: 'Evaluator', isActive: true, assignedCenters: [] });
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

        init();

        return () => {
            try {
                if (typeof unsubscribe === 'function') unsubscribe();
            } catch (e) {
                /* ignore */
            }
        };
    }, []);

    return (
        <AuthContext.Provider value={{ currentUser, loading }}>
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                    <CircularProgress />
                </Box>
            ) : children}
        </AuthContext.Provider>
    );
};