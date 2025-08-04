import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Box, Button, Typography, Paper, Snackbar, Alert, CircularProgress } from '@mui/material';
import RatingScaleWithNotes from './RatingScaleWithNotes';

// Define a helper function for the initial state
const createInitialState = (fields) => {
    const state = {};
    fields.forEach(field => {
        state[field] = { score: '3', note: '' };
    });
    return state;
};

const intellectFields = [
    'subjectKnowledge', 'materialReadiness', 'childCentricTeaching', 'differentialMethods',
    'lessonPlanImplementation', 'reportQuality', 'learnersEngagement', 'percentageOfLearners'
];

const IntellectKPIForm = () => {
    const { mentorId } = useParams();
    const navigate = useNavigate();
    const [formData, setFormData] = useState(createInitialState(intellectFields));
    const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });
    const [loading, setLoading] = useState(false);

    const handleChange = (field) => (value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        // Check if mentorId exists
        if (!mentorId) {
            setNotification({ 
                open: true, 
                message: 'Error: Mentor ID not found. Please try again.', 
                severity: 'error' 
            });
            setLoading(false);
            return;
        }

        const submissionData = {
            ...formData
        };
        // Convert score strings to numbers
        for (const key in submissionData) {
            submissionData[key].score = parseInt(submissionData[key].score, 10);
        }

        try {
            await addDoc(collection(db, 'kpiSubmissions'), {
                mentorId,
                kpiType: "Intellect",
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

    return (
        <>
            <Paper component="form" onSubmit={handleSubmit} sx={{ p: { xs: 2, md: 3 } }}>
                <Typography variant="h4" gutterBottom>Intellect KPI Form</Typography>

                <RatingScaleWithNotes label="4. Subject knowledge *" value={formData.subjectKnowledge} onChange={handleChange('subjectKnowledge')} options={['Critical', 'Not Up to Expectation', 'As Expected', 'Shows Intention', 'Exceeds Expectations']} />
                <RatingScaleWithNotes label="6. Material readiness *" value={formData.materialReadiness} onChange={handleChange('materialReadiness')} options={['Never Prepares', '1-2 days prepared', '3 days prepared', '4 days prepared', 'Ready Everyday']} />
                <RatingScaleWithNotes label="8. Child-Centric Teaching *" value={formData.childCentricTeaching} onChange={handleChange('childCentricTeaching')} options={['Critical', 'Not Up to Expectation', 'As Expected', 'Shows Intention', 'Exceeds Expectations']} />
                <RatingScaleWithNotes label="10. Differential Methods / Experiential Learning *" value={formData.differentialMethods} onChange={handleChange('differentialMethods')} options={['Critical', 'Not Up to Expectation', 'As Expected', 'Shows Intention', 'Exceeds Expectations']} />
                <RatingScaleWithNotes label="12. Lesson Plan Implementation" value={formData.lessonPlanImplementation} onChange={handleChange('lessonPlanImplementation')} options={['Never', 'Rarely', 'Sometimes', 'Often', 'Always']} />
                <RatingScaleWithNotes label="14. Report Quality" value={formData.reportQuality} onChange={handleChange('reportQuality')} options={['Defensive of feedback', 'Takes Feedback, No Action', 'Inconsistent', 'Consistently integrates feedback', 'Implements feedback']} />
                <RatingScaleWithNotes label="16. Learners Engagement *" value={formData.learnersEngagement} onChange={handleChange('learnersEngagement')} options={['Critical', 'Not Up to Expectation', 'As Expected', 'Shows Intention', 'Exceeds Expectations']} />
                <RatingScaleWithNotes label="18. Percentage of learners engaged *" value={formData.percentageOfLearners} onChange={handleChange('percentageOfLearners')} options={['< 50%', '50%', '60%', '80%', '> 80%']} />

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

export default IntellectKPIForm;