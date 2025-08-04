import React from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, googleProvider } from '../firebase/config';
import { signInWithPopup } from 'firebase/auth';
import { Button, Container, Typography, Paper, Box } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import logo from '../assets/logo.png'; // <-- Import your logo

const Login = () => {
    const navigate = useNavigate();

    const handleGoogleSignIn = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
            navigate('/');
        } catch (error) {
            console.error("Authentication error:", error);
        }
    };

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
                <Typography component="h1" variant="h5">
                    KPI Assessor Login
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
            </Paper>
        </Container>
    );
};

export default Login;