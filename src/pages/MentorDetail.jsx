import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase/config';
import { doc, getDoc, collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { Box, Typography, Button, Paper, CircularProgress, List, ListItem, ListItemText, Divider, Grid } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTheme, useMediaQuery } from '@mui/material';
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

    const getKpiData = (kpiType) => {
        const filteredSubs = submissions.filter(s => s.kpiType === kpiType);
        if (filteredSubs.length === 0) return { monthlyData: [], notes: [], totalResponses: 0 };

        // Get current academic year start date (April 2025)
        const currentDate = new Date();
        const academicYearStart = new Date(currentDate.getFullYear(), 3, 1); // April 1st of current year
        if (currentDate < academicYearStart) {
            academicYearStart.setFullYear(academicYearStart.getFullYear() - 1);
        }

        // Group submissions by month and calculate average scores
        const monthlySubmissions = {};
        filteredSubs.forEach(sub => {
            const submissionDate = sub.createdAt.toDate();
            if (submissionDate >= academicYearStart) {
                const monthKey = `${submissionDate.getFullYear()}-${String(submissionDate.getMonth() + 1).padStart(2, '0')}`;
                if (!monthlySubmissions[monthKey]) {
                    monthlySubmissions[monthKey] = [];
                }
                const scores = Object.values(sub.form).map(item => item.score).filter(score => typeof score === 'number');
                const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
                monthlySubmissions[monthKey].push(avgScore);
            }
        });

        // Calculate monthly averages and format for chart
        const monthlyData = Object.entries(monthlySubmissions)
            .map(([month, scores]) => ({
                month,
                average: scores.reduce((a, b) => a + b, 0) / scores.length
            }))
            .sort((a, b) => a.month.localeCompare(b.month));

        // Get notes from latest 5 submissions
        const allNotes = filteredSubs.slice(0, 5).flatMap(sub =>
            Object.values(sub.form)
                .map(item => item.note)
                .filter(note => note && note.trim() !== '')
        );
        
        return { 
            monthlyData,
            notes: allNotes.slice(0, 5),
            totalResponses: filteredSubs.length,
            latestScore: monthlyData.length > 0 ? monthlyData[monthlyData.length - 1].average : 0
        };
    };

    if (loading) return <CircularProgress />;
    if (!mentor) return <Typography>Mentor not found.</Typography>;

    const intellectData = getKpiData('Intellect');
    const culturalData = getKpiData('Cultural');

    // Custom chart component to show score labels for desktop only
    const ChartWithLabels = ({ data }) => {
        // Custom label renderer for scores, with background for visibility
        const renderScoreLabel = (props) => {
            const { x, y, value, index } = props;
            // Offset labels slightly to avoid overlap
            const yOffset = -16;
            return (
                <g>
                    <rect x={x - 14} y={y + yOffset - 10} width={28} height={18} rx={4} fill="#fff" opacity={0.8} />
                    <text x={x} y={y + yOffset} textAnchor="middle" fontSize="12" fill="#555" style={{ pointerEvents: 'none', fontWeight: 600 }}>
                        {value.toFixed(1)}
                    </text>
                </g>
            );
        };

        return (
            <Box sx={{ width: '100%', height: 300, mt: 3, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <ResponsiveContainer>
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                            dataKey="month" 
                            tickFormatter={(value) => {
                                const [year, month] = value.split('-');
                                return `${new Date(year, month - 1).toLocaleString('default', { month: 'short' })}`;
                            }}
                        />
                        <YAxis domain={[0, 5]} />
                        <Tooltip 
                            formatter={(value) => [value.toFixed(2), "Average Score"]}
                            labelFormatter={(value) => {
                                const [year, month] = value.split('-');
                                return `${new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}`;
                            }}
                        />
                        <Line 
                            type="monotone" 
                            dataKey="average" 
                            stroke="#8884d8" 
                            strokeWidth={2} 
                            dot={{ r: 4 }}
                            label={renderScoreLabel}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </Box>
        );
    };

    // Helper to get month name for latest entry
    const getLatestMonthName = (monthlyData) => {
        if (!monthlyData || monthlyData.length === 0) return '';
        const latest = monthlyData[monthlyData.length - 1];
        if (!latest || !latest.month) return '';
        const [year, month] = latest.month.split('-');
        return new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
    };

    const KPISection = ({ title, data, formType }) => (
        <Paper sx={{ p: { xs: 2, md: 3 }, mt: 3 }}>
            <Typography variant="h5">{title}</Typography>
            {/* Responsive chart with score labels for desktop only */}
            <ChartWithLabels data={data.monthlyData} />
            <Divider sx={{ my: 3 }} />
            <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                    <Typography variant="h4" align="center">{data.totalResponses}</Typography>
                    <Typography variant="body1" align="center">Responses</Typography>
                    {data.latestScore > 0 && (
                        <>
                            <Typography variant="h4" align="center" sx={{ mt: 2 }}>{data.latestScore.toFixed(1)}</Typography>
                            <Typography variant="body1" align="center" sx={{ wordBreak: 'break-word', whiteSpace: 'normal', maxWidth: 180, mx: 'auto' }}>
                                Latest Score ({getLatestMonthName(data.monthlyData)})
                            </Typography>
                        </>
                    )}
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