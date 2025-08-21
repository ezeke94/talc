import React, { createContext, useState, useEffect, useContext } from 'react';
import { auth, db } from '../firebase/config';
import { onAuthStateChanged, getRedirectResult } from 'firebase/auth';
import { CircularProgress, Box } from '@mui/material';
import { setupNotifications } from '../utils/notifications';
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
            // Keep loading true while we check for any redirect sign-in results
            try {
                await getRedirectResult(auth);
            } catch (e) {
                // No redirect result or failure is okay — continue
                console.debug('No redirect result or redirect processing failed:', e?.message || e);
            }

            // Now subscribe to auth state changes
            unsubscribe = onAuthStateChanged(auth, async user => {
                // Whenever auth state changes, mark as loading until we finish syncing profile
                setLoading(true);
                if (user) {
                    // Set the raw Firebase user immediately so routes can proceed
                    setCurrentUser(prev => prev || user);
                    // Run notifications setup in background so it cannot block auth loading
                    setupNotifications(user).catch(err => {
                        console.error('Notification setup failed (background):', err);
                    });
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
                    }
                } else {
                    setCurrentUser(null);
                }
                setLoading(false);
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