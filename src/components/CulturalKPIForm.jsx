import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Box, Button, Typography, Paper, Snackbar, Alert, CircularProgress } from '@mui/material';
import RatingScaleWithNotes from './RatingScaleWithNotes';
import { culturalFields, kpiFieldLabels, culturalOptionsMap, defaultOptions } from '../constants/kpiFields';

// Helper function for the initial state
const createInitialState = (fields) => {
    const state = {};
    fields.forEach(field => {
        state[field] = { score: '3', note: '' };
    });
    return state;
};



const CulturalKPIForm = () => {
    // Ensure page is scrolled to top when this form mounts
    useEffect(() => {
        try {
            window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
            document.body.scrollTop = 0;
            document.documentElement.scrollTop = 0;
        } catch { /* ignore in non-browser environments */ }
    }, []);
    const { mentorId } = useParams();
    const navigate = useNavigate();
    const [formData, setFormData] = useState(createInitialState(culturalFields));
    const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });
    const [loading, setLoading] = useState(false);

    const handleChange = (field) => (value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        // Enhanced mentorId validation
        if (!mentorId) {
            setNotification({ 
                open: true, 
                message: 'Error: Mentor ID not found. Please try again.', 
                severity: 'error' 
            });
            setLoading(false);
            return;
        }

        const submissionData = { ...formData };
        for (const key in submissionData) {
            submissionData[key].score = parseInt(submissionData[key].score, 10);
        }

        try {
            await addDoc(collection(db, 'kpiSubmissions'), {
                mentorId,
                kpiType: "Cultural",
                form: submissionData,
                createdAt: serverTimestamp(),
                assessorId: auth.currentUser.uid,
                assessorName: auth.currentUser.displayName,
            });
            setNotification({ open: true, message: 'Submission successful!', severity: 'success' });
            setTimeout(() => navigate(`/mentor/${mentorId}`), 1500);
        } catch (error) {
            console.error("Error submitting form: ", error);
            const errorMessage = error.code === 'not-found' 
                ? 'Mentor not found. Please check the mentor ID.'
                : 'Submission failed. Please try again.';
            setNotification({ open: true, message: errorMessage, severity: 'error' });
            setLoading(false);
        }
    };

    const handleCloseNotification = () => {
        setNotification({ ...notification, open: false });
    };
    
    // options and labels are imported from shared constants

    return (
        <>
            <Paper component="form" onSubmit={handleSubmit} sx={{ p: { xs: 2, md: 3 }, bgcolor: 'background.paper', borderRadius: 3, boxShadow: '0 2px 8px 0 rgba(80, 63, 205, 0.04)' }}>
                <Typography variant="h4" gutterBottom>Cultural KPI Form</Typography>
                {culturalFields.map((field, idx) => (
                     <RatingScaleWithNotes 
                        key={field}
                        label={`${idx + 1}. ${kpiFieldLabels[field] || field}`}
                        value={formData[field]} 
                        onChange={handleChange(field)} 
                        options={culturalOptionsMap[field] || defaultOptions} 
                    />
                ))}
                <Box mt={3}>
                    <Button type="submit" variant="contained" color="secondary" disabled={loading} fullWidth sx={{ borderRadius: 2, fontWeight: 600, fontSize: '1rem', py: 1.2 }}>
                        {loading ? <CircularProgress size={24} color="inherit" /> : 'Submit Form'}
                    </Button>
                </Box>
            </Paper>

            <Snackbar open={notification.open} autoHideDuration={6000} onClose={handleCloseNotification} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert onClose={handleCloseNotification} severity={notification.severity} sx={{ width: '100%' }}>
                    {notification.message}
                </Alert>
            </Snackbar>
        </>
    );
};

export default CulturalKPIForm;