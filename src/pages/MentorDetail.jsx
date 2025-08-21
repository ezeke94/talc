import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase/config';
import { doc, getDoc, collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { Box, Typography, Button, Paper, CircularProgress, List, ListItem, ListItemText, Divider, Grid, Dialog, DialogTitle, DialogContent, IconButton, Card, CardContent, Avatar, useTheme, useMediaQuery, Skeleton, Fade, Collapse, Tabs, Tab } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
// ...existing code...
import KPIScoreScale from '../components/KPIScoreScale';

const MentorDetail = () => {
    const { mentorId } = useParams();
    const navigate = useNavigate();
    const [mentor, setMentor] = useState(null);
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notesDialogOpen, setNotesDialogOpen] = useState(false);
    const [allNotes, setAllNotes] = useState([]);
    const [notesPage, setNotesPage] = useState(1);
    const [expandedNotes, setExpandedNotes] = useState({});
    const [activeKpiTab, setActiveKpiTab] = useState(0);
    const NOTES_PER_PAGE = 10;
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    useEffect(() => {
        setLoading(true);
        setError(null);
        const fetchMentor = async () => {
            try {
                const docRef = doc(db, 'mentors', mentorId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setMentor({ id: docSnap.id, ...docSnap.data() });
                } else {
                    setError('Mentor not found.');
                }
            } catch (err) {
                setError('Failed to load mentor data.');
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
        }, (err) => {
            setError('Failed to load KPI submissions.');
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

    if (loading) return <Box sx={{ p: 3 }}><Skeleton variant="rectangular" height={180} sx={{ mb: 2 }} /><Skeleton height={40} sx={{ mb: 1 }} /><Skeleton height={40} sx={{ mb: 1 }} /><Skeleton height={40} /></Box>;
    if (error) return <Box sx={{ p: 3 }}><Typography color="error" variant="h6">{error}</Typography></Box>;
    if (!mentor) return null;

    // Show all assigned centers or fallback to center
    const centers = Array.isArray(mentor.assignedCenters) ? mentor.assignedCenters : (mentor.center ? [mentor.center] : []);

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
            <Box sx={{ width: '100%', height: isMobile ? 220 : 300, mt: 3, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
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

    // Responsive KPI section layout with notes expansion
    const KPISection = ({ title, data, formType, kpiType }) => (
        <Fade in timeout={500}>
            <Paper sx={{ p: { xs: 2, md: 3 }, mt: 3 }}>
                <Typography variant="h5" sx={{ mb: 2 }}>{title}</Typography>
                <ChartWithLabels data={data.monthlyData} />
                <Divider sx={{ my: 3 }} />
                <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 2 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
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
                    </Box>
                    <Box sx={{ flex: 2, minWidth: 0 }}>
                        <Typography variant="h6">Latest Notes (up to 5)</Typography>
                        <List dense>
                            {data.notes.length > 0 ? data.notes.map((noteObj, index) => (
                                <React.Fragment key={index}>
                                    <ListItem disableGutters>
                                        <ListItemText 
                                            primary={<Button variant="text" sx={{ textAlign: 'left', p: 0, minWidth: 0 }} onClick={() => setExpandedNotes(prev => ({ ...prev, [noteObj.field + index]: !prev[noteObj.field + index] }))}>{`"${noteObj.note}"`}</Button>}
                                            secondary={`By ${noteObj.evaluatorName || 'Unknown'} on ${noteObj.createdAt ? noteObj.createdAt.toLocaleDateString() : ''}`}
                                        />
                                    </ListItem>
                                    <Collapse in={!!expandedNotes[noteObj.field + index]} timeout="auto" unmountOnExit>
                                        <Box sx={{ pl: 2, pb: 1 }}>
                                            <Typography variant="body2" color="text.secondary">Field: {noteObj.field}</Typography>
                                        </Box>
                                    </Collapse>
                                </React.Fragment>
                            )) : <ListItem><ListItemText primary="No recent notes available."/></ListItem>}
                        </List>
                        <Button variant="text" sx={{ mt: 1 }} onClick={() => {
                            setAllNotes(getAllNotes(kpiType));
                            setNotesDialogOpen(true);
                            setNotesPage(1);
                        }}>View More</Button>
                    </Box>
                </Box>
                <Button variant="contained" onClick={() => navigate(`/mentor/${mentorId}/fill-${formType}-kpi`)} sx={{ mt: 3 }} fullWidth>
                    Fill {title} Form
                </Button>
            </Paper>
        </Fade>
    );

    // Notes dialog for viewing all notes
    const paginatedNotes = allNotes.slice((notesPage - 1) * NOTES_PER_PAGE, notesPage * NOTES_PER_PAGE);

    return (
        <Box>
            {/* Mentor Info Card with fade-in and edit action */}
            <Fade in timeout={500}>
                <Card sx={{ mb: 3, boxShadow: 2, borderRadius: 3, display: 'flex', alignItems: 'center', p: 2 }}>
                    <Avatar sx={{ width: 64, height: 64, bgcolor: 'primary.light', fontWeight: 700, mr: 2 }}>
                        {mentor.name ? mentor.name.charAt(0).toUpperCase() : '?'}
                    </Avatar>
                    <CardContent sx={{ flex: 1, p: 0 }}>
                        <Typography variant="h4" sx={{ fontWeight: 700 }}>{mentor.name}</Typography>
                        <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                            {centers.length > 0 ? centers.join(', ') : 'No center assigned'}
                        </Typography>
                    </CardContent>
                    <Button variant="outlined" sx={{ ml: 2 }} aria-label="Edit Mentor" onClick={() => navigate(`/mentors?edit=${mentor.id}`)}>Edit</Button>
                </Card>
            </Fade>

            {/* KPI Section Tabs for mobile, side-by-side for desktop */}
            {isMobile ? (
                <Tabs value={activeKpiTab} onChange={(_, v) => setActiveKpiTab(v)} variant="fullWidth" sx={{ mb: 2 }}>
                    <Tab label="Intellect KPI" />
                    <Tab label="Cultural KPI" />
                </Tabs>
            ) : null}
            {(!isMobile || activeKpiTab === 0) && <KPISection title="Intellect KPI" data={intellectData} formType="intellect" kpiType="Intellect" />}
            {(!isMobile || activeKpiTab === 1) && <KPISection title="Cultural KPI" data={culturalData} formType="cultural" kpiType="Cultural" />}

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
                                    primary={<Button variant="text" sx={{ textAlign: 'left', p: 0, minWidth: 0 }} onClick={() => setExpandedNotes(prev => ({ ...prev, [noteObj.field + idx]: !prev[noteObj.field + idx] }))}>{`"${noteObj.note}"`}</Button>}
                                    secondary={`By ${noteObj.evaluatorName || 'Unknown'} on ${noteObj.createdAt ? noteObj.createdAt.toLocaleDateString() : ''} (${noteObj.field})`}
                                />
                                <Collapse in={!!expandedNotes[noteObj.field + idx]} timeout="auto" unmountOnExit>
                                    <Box sx={{ pl: 2, pb: 1 }}>
                                        <Typography variant="body2" color="text.secondary">Field: {noteObj.field}</Typography>
                                    </Box>
                                </Collapse>
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