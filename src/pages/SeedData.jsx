import React, { useState } from 'react';
import { db } from '../firebase/config';
import { collection, writeBatch, addDoc, doc } from 'firebase/firestore';
import { mentors as seedMentors, kpiSubmissions as seedKpiSubmissions } from '../utils/seedData';
import seedKpiData from '../utils/seedKpiData';
import { Button, Typography, Box, CircularProgress, Alert, Paper, Stack } from '@mui/material';

const SeedData = () => {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const handleSeedData = async () => {
        setLoading(true);
        setMessage('');

        try {
            // Step 1: Seed Mentors.
            const mentorIds = [];
            for (const mentorData of seedMentors) {
                const docRef = await addDoc(collection(db, "mentors"), mentorData);
                mentorIds.push(docRef.id);
            }
            
            // Step 2: Prepare a batch write for all KPI submissions.
            const kpiBatch = writeBatch(db);
            const submissions = seedKpiSubmissions(mentorIds);

            submissions.forEach(submission => {
                const subDocRef = doc(collection(db, "kpiSubmissions")); 
                kpiBatch.set(subDocRef, submission);
            });
            
            // Step 3: Commit the batch of KPI submissions.
            await kpiBatch.commit();
            
            setMessage(`Successfully seeded ${mentorIds.length} mentors and ${submissions.length} KPI submissions!`);
        } catch (error) {
            console.error("Error seeding data:", error);
            setMessage(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleSeedKpiData = async () => {
        setLoading(true);
        setMessage('');
        try {
            await seedKpiData();
            setMessage('Successfully seeded KPI data for selected mentors!');
        } catch (error) {
            console.error("Error seeding KPI data:", error);
            setMessage(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Paper sx={{p: 3}}>
            <Typography variant="h4" gutterBottom>Seed Firestore Data</Typography>
            <Typography paragraph color="text.secondary">
                Click the buttons below to populate your database with sample data.
                This is for testing only. Before seeding, you should clear the respective collections in Firebase to avoid duplicates.
            </Typography>
            <Stack direction="row" spacing={2}>
                <Button
                    variant="contained"
                    color="secondary"
                    onClick={handleSeedData}
                    disabled={loading}
                >
                    {loading ? <CircularProgress size={24} /> : 'Seed Initial Data'}
                </Button>
                <Button
                    variant="contained"
                    color="primary"
                    onClick={handleSeedKpiData}
                    disabled={loading}
                >
                    {loading ? <CircularProgress size={24} /> : 'Seed KPI Data'}
                </Button>
            </Stack>
            {message && (
                <Alert severity={message.startsWith('Error') ? 'error' : 'success'} sx={{ mt: 2 }}>
                    {message}
                </Alert>
            )}
        </Paper>
    );
};

export default SeedData;