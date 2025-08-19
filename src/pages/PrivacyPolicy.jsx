import React from 'react';
import { Container, Typography, Paper } from '@mui/material';

const PrivacyPolicy = () => (
    <Container maxWidth="md">
        <Paper sx={{ p: 4, mt: 6 }}>
            <Typography variant="h4" gutterBottom>Privacy Policy</Typography>
            <Typography variant="body1" paragraph>
                TALC Management respects your privacy. We do not share your personal information except as required for application functionality. Data is stored securely and only accessible to authorized users. For more details, contact us at <a href="https://www.talcworld.com" target="_blank" rel="noopener noreferrer">talcworld.com</a>.
            </Typography>
            <Typography variant="body2" color="text.secondary">
                Last updated: August 19, 2025
            </Typography>
        </Paper>
    </Container>
);

export default PrivacyPolicy;
