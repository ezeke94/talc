import React from 'react';
import { Container, Typography, Paper } from '@mui/material';

const TermsOfUse = () => (
    <Container maxWidth="md">
        <Paper sx={{ p: 4, mt: 6 }}>
            <Typography variant="h4" gutterBottom>Terms of Use</Typography>
            <Typography variant="body1" paragraph>
                By using TALC Management, you agree to use the application responsibly and respect the privacy of other users. All data and content are the property of TALC. Misuse or unauthorized access may result in account suspension. For questions, visit <a href="https://www.talcworld.com" target="_blank" rel="noopener noreferrer">talcworld.com</a>.
            </Typography>
            <Typography variant="body2" color="text.secondary">
                Last updated: August 19, 2025
            </Typography>
        </Paper>
    </Container>
);

export default TermsOfUse;
