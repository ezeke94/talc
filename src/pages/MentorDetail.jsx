import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase/config';
import { doc, getDoc, collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { Box, Typography, Button, Paper, CircularProgress, List, ListItem, ListItemText, Divider, Grid } from '@mui/material';
import KPIScoreScale from '../components/KPIScoreScale';

const MentorDetail = () => {
    const { mentorId } = useParams();
    const navigate = useNavigate();
    const [mentor, setMentor] = useState(null);
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMentor = async () => {
            const docRef = doc(db, 'mentors', mentorId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setMentor({ id: docSnap.id, ...docSnap.data() });
            }
        };

        const q = query(
            collection(db, 'kpiSubmissions'),
            where('mentorId', '==', mentorId),
            orderBy('createdAt', 'desc')
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const subsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setSubmissions(subsData);
            setLoading(false);
        });

        fetchMentor();
        return () => unsubscribe();
    }, [mentorId]);

    const getLatestKpiData = (kpiType) => {
        const filteredSubs = submissions.filter(s => s.kpiType === kpiType);
        if (filteredSubs.length === 0) return { avgScore: 0, notes: [], totalResponses: 0 };

        const latestSub = filteredSubs[0];
        const scores = Object.values(latestSub.form).map(item => item.score).filter(score => typeof score === 'number');
        const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        
        // Aggregate all non-empty notes from the latest 5 submissions
        const allNotes = filteredSubs.slice(0, 5).flatMap(sub =>
            Object.values(sub.form)
                .map(item => item.note)
                .filter(note => note && note.trim() !== '')
        );
        
        return { avgScore, notes: allNotes.slice(0, 5), totalResponses: filteredSubs.length };
    };

    if (loading) return <CircularProgress />;
    if (!mentor) return <Typography>Mentor not found.</Typography>;

    const intellectData = getLatestKpiData('Intellect');
    const culturalData = getLatestKpiData('Cultural'); // Assuming cultural form is also updated

    const KPISection = ({ title, data, formType }) => (
        <Paper sx={{ p: { xs: 2, md: 3 }, mt: 3 }}>
            <Typography variant="h5">{title}</Typography>
            <KPIScoreScale score={data.avgScore} />
            <Divider sx={{ my: 3 }} />
            <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                    <Typography variant="h4" align="center">{data.totalResponses}</Typography>
                    <Typography variant="body1" align="center">Responses</Typography>
                </Grid>
                <Grid item xs={12} sm={8}>
                    <Typography variant="h6">Latest Notes (up to 5)</Typography>
                    <List dense>
                        {data.notes.length > 0 ? data.notes.map((note, index) => (
                           <ListItem key={index} disableGutters><ListItemText primary={`" ${note} "`}/></ListItem>
                        )) : <ListItem><ListItemText primary="No recent notes available."/></ListItem>}
                    </List>
                </Grid>
            </Grid>
            <Button variant="contained" onClick={() => navigate(`/mentor/${mentorId}/fill-${formType}-kpi`)} sx={{ mt: 3 }} fullWidth>
                Fill {title} Form
            </Button>
        </Paper>
    );

    return (
        <Box>
            <Typography variant="h4" gutterBottom>{mentor.name}</Typography>
            <Typography variant="h6" color="text.secondary">{mentor.center}</Typography>
            
            <KPISection title="Intellect KPI" data={intellectData} formType="intellect" />
            <KPISection title="Cultural KPI" data={culturalData} formType="cultural" />
        </Box>
    );
};

export default MentorDetail;