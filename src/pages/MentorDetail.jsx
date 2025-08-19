import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase/config';
import { doc, getDoc, collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { Box, Typography, Button, Paper, CircularProgress, List, ListItem, ListItemText, Divider, Grid, Dialog, DialogTitle, DialogContent, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTheme, useMediaQuery } from '@mui/material';
import KPIScoreScale from '../components/KPIScoreScale';

const MentorDetail = () => {
    const { mentorId } = useParams();
    const navigate = useNavigate();
    const [mentor, setMentor] = useState(null);
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [notesDialogOpen, setNotesDialogOpen] = useState(false);
    const [allNotes, setAllNotes] = useState([]);
    const [notesPage, setNotesPage] = useState(1);
    const NOTES_PER_PAGE = 10;

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

    // Helper to extract all notes for a mentor and kpiType, with evaluator name and date
    const getAllNotes = (kpiType) => {
        const filteredSubs = submissions.filter(s => s.kpiType === kpiType);
        let notesArr = [];
        filteredSubs.forEach(sub => {
            Object.entries(sub.form).forEach(([field, item]) => {
                if (item.note && item.note.trim() !== '') {
                    notesArr.push({
                        note: item.note,
                        field,
                        evaluatorName: sub.evaluatorName || sub.assessorName,
                        createdAt: sub.createdAt.toDate(),
                    });
                }
            });
        });
        // Sort by date desc
        notesArr.sort((a, b) => b.createdAt - a.createdAt);
        return notesArr;
    };

    const getKpiData = (kpiType) => {
        const filteredSubs = submissions.filter(s => s.kpiType === kpiType);
        if (filteredSubs.length === 0) return { monthlyData: [], notes: [], totalResponses: 0 };

        // Academic year logic
        const currentDate = new Date();
        const academicYearStart = new Date(currentDate.getFullYear(), 3, 1);
        if (currentDate < academicYearStart) {
            academicYearStart.setFullYear(academicYearStart.getFullYear() - 1);
        }

        // Monthly averages
        const monthlySubmissions = {};
        filteredSubs.forEach(sub => {
            const submissionDate = sub.createdAt.toDate();
            if (submissionDate >= academicYearStart) {
                const monthKey = `${submissionDate.getFullYear()}-${String(submissionDate.getMonth() + 1).padStart(2, '0')}`;
                if (!monthlySubmissions[monthKey]) monthlySubmissions[monthKey] = [];
                const scores = Object.values(sub.form).map(item => item.score).filter(score => typeof score === 'number');
                const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
                monthlySubmissions[monthKey].push(avgScore);
            }
        });
        const monthlyData = Object.entries(monthlySubmissions)
            .map(([month, scores]) => ({
                month,
                average: scores.reduce((a, b) => a + b, 0) / scores.length
            }))
            .sort((a, b) => a.month.localeCompare(b.month));

        // Get notes from latest 5 submissions (for preview)
        const previewNotes = [];
        filteredSubs.slice(0, 5).forEach(sub => {
            Object.entries(sub.form).forEach(([field, item]) => {
                if (item.note && item.note.trim() !== '') {
                    previewNotes.push({
                        note: item.note,
                        field,
                        evaluatorName: sub.evaluatorName || sub.assessorName,
                        createdAt: sub.createdAt.toDate(),
                    });
                }
            });
        });

        return {
            monthlyData,
            notes: previewNotes.slice(0, 5),
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

    const KPISection = ({ title, data, formType, kpiType }) => (
        <Paper sx={{ p: { xs: 2, md: 3 }, mt: 3 }}>
            <Typography variant="h5">{title}</Typography>
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
                        {data.notes.length > 0 ? data.notes.map((noteObj, index) => (
                            <ListItem key={index} disableGutters>
                                <ListItemText 
                                    primary={`"${noteObj.note}"`}
                                    secondary={`By ${noteObj.evaluatorName || 'Unknown'} on ${noteObj.createdAt ? noteObj.createdAt.toLocaleDateString() : ''}`}
                                />
                            </ListItem>
                        )) : <ListItem><ListItemText primary="No recent notes available."/></ListItem>}
                    </List>
                    <Button variant="text" sx={{ mt: 1 }} onClick={() => {
                        setAllNotes(getAllNotes(kpiType));
                        setNotesDialogOpen(true);
                        setNotesPage(1);
                    }}>View More</Button>
                </Grid>
            </Grid>
            <Button variant="contained" onClick={() => navigate(`/mentor/${mentorId}/fill-${formType}-kpi`)} sx={{ mt: 3 }} fullWidth>
                Fill {title} Form
            </Button>
        </Paper>
    );

    // Notes dialog for viewing all notes
    const paginatedNotes = allNotes.slice((notesPage - 1) * NOTES_PER_PAGE, notesPage * NOTES_PER_PAGE);

    return (
        <Box>
            <Typography variant="h4" gutterBottom>{mentor.name}</Typography>
            <Typography variant="h6" color="text.secondary">{mentor.center}</Typography>

            <KPISection title="Intellect KPI" data={intellectData} formType="intellect" kpiType="Intellect" />
            <KPISection title="Cultural KPI" data={culturalData} formType="cultural" kpiType="Cultural" />

            <Dialog open={notesDialogOpen} onClose={() => setNotesDialogOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>
                    All Notes
                    <IconButton aria-label="close" onClick={() => setNotesDialogOpen(false)} sx={{ position: 'absolute', right: 8, top: 8 }}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    <List>
                        {paginatedNotes.length > 0 ? paginatedNotes.map((noteObj, idx) => (
                            <ListItem key={idx} alignItems="flex-start">
                                <ListItemText 
                                    primary={`"${noteObj.note}"`}
                                    secondary={`By ${noteObj.evaluatorName || 'Unknown'} on ${noteObj.createdAt ? noteObj.createdAt.toLocaleDateString() : ''} (${noteObj.field})`}
                                />
                            </ListItem>
                        )) : <ListItem><ListItemText primary="No notes found." /></ListItem>}
                    </List>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                        <Button disabled={notesPage === 1} onClick={() => setNotesPage(notesPage - 1)}>Previous</Button>
                        <Typography>Page {notesPage} / {Math.ceil(allNotes.length / NOTES_PER_PAGE)}</Typography>
                        <Button disabled={notesPage * NOTES_PER_PAGE >= allNotes.length} onClick={() => setNotesPage(notesPage + 1)}>Next</Button>
                    </Box>
                </DialogContent>
            </Dialog>
        </Box>
    );
};

export default MentorDetail;