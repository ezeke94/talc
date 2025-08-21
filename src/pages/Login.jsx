import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, googleProvider } from '../firebase/config';
import { signInWithPopup } from 'firebase/auth';
import { Button, Container, Typography, Paper, Box } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import logo from '../assets/logo.png'; // <-- Import your logo
import { useAuth } from '../context/AuthContext';

const Login = () => {
    const navigate = useNavigate();
    const { currentUser, loading } = useAuth();

    useEffect(() => {
        if (!loading && currentUser) {
            navigate('/');
        }
    }, [currentUser, loading, navigate]);

    const handleGoogleSignIn = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
            navigate('/');
        } catch (error) {
            console.error("Authentication error:", error);
        }
    };

    // Optionally avoid flashing the login screen while checking auth
    if (loading) return null;

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