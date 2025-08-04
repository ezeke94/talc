import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Box, Button, Typography, Paper, Snackbar, Alert, CircularProgress } from '@mui/material';
import RatingScaleWithNotes from './RatingScaleWithNotes';

// Helper function for the initial state
const createInitialState = (fields) => {
    const state = {};
    fields.forEach(field => {
        state[field] = { score: '3', note: '' };
    });
    return state;
};

const culturalFields = [
    'teamWork', 'professionalismLogin', 'professionalismGrooming', 'childSafetyHazards',
    'childSafetyEnvironment', 'childCentricityEngagement', 'childCentricityDevelopment',
    'selfDevelopment', 'ethicsAndConduct', 'documentation', 'accountabilityIndependent', 'accountabilityGoals'
];

const kpiLabels = {
    teamWork: 'Team work - Handles disagreements respectfully',
    professionalismLogin: 'Professionalism - Logs in before 8:10 AM consistently',
    professionalismGrooming: 'Professionalism - Maintains appropriate and tidy grooming',
    childSafetyHazards: 'Child Safety - Prevents hazards and addresses safety concerns',
    childSafetyEnvironment: 'Child Safety - Maintains emotionally safe environment',
    childCentricityEngagement: 'Child Centricity - Maintains meaningful engagement',
    childCentricityDevelopment: 'Child Centricity - Plans for emotional, social, and intellectual development',
    selfDevelopment: 'Self Development - Follows trends, stays updated, and adjusts',
    ethicsAndConduct: 'Ethics & Conduct - Is accountable, reliable and has integrity',
    documentation: 'Documentation - Timeliness in updating all child documentation',
    accountabilityIndependent: 'Accountability - Completes tasks independently',
    accountabilityGoals: 'Accountability - Sees tasks through to completion'
};


const CulturalKPIForm = () => {
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
    
    const options = ['Critical', 'Not Up to Expectation', 'As Expected', 'Shows Intention', 'Exceptional'];

    return (
        <>
            <Paper component="form" onSubmit={handleSubmit} sx={{ p: { xs: 2, md: 3 } }}>
                <Typography variant="h4" gutterBottom>Cultural KPI Form</Typography>

                {culturalFields.map(field => (
                     <RatingScaleWithNotes 
                        key={field}
                        label={kpiLabels[field]} 
                        value={formData[field]} 
                        onChange={handleChange(field)} 
                        options={options} 
                    />
                ))}

                <Box mt={3}>
                    <Button type="submit" variant="contained" color="primary" disabled={loading} fullWidth>
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