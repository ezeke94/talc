import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase/config';
import { doc, getDoc, collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { Box, Typography, Button, Paper, CircularProgress, List, ListItem, ListItemText, Divider, Grid, Dialog, DialogTitle, DialogContent, IconButton, Card, CardContent, Avatar, useTheme, useMediaQuery, Skeleton, Fade, Collapse, Tabs, Tab, Chip, Stack } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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

    // Friendly labels for KPI form fields (kept in sync with the form components)
    const kpiFieldLabels = {
        // Intellect
        subjectKnowledge: 'Subject knowledge',
        materialReadiness: 'Material readiness',
        childCentricTeaching: 'Child-Centric Teaching',
        differentialMethods: 'Differential Methods / Experiential Learning',
        lessonPlanImplementation: 'Lesson Plan Implementation',
        reportQuality: 'Report Quality',
        learnersEngagement: 'Learners Engagement',
        percentageOfLearners: 'Percentage of learners engaged',
        // Cultural
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
    const parseDate = (ts) => {
        if (!ts) return null;
        if (typeof ts?.toDate === 'function') return ts.toDate();
        if (typeof ts === 'object' && ts.seconds) return new Date(ts.seconds * 1000);
        const d = new Date(ts);
        return isNaN(d.getTime()) ? null : d;
    };

    // Return full submissions (with parsed createdAt) for a KPI type, newest first
    const getAllNotes = (kpiType) => {
        const filteredSubs = submissions.filter(s => s.kpiType === kpiType);
        const subs = filteredSubs.map(sub => ({
            id: sub.id,
            evaluatorName: sub.evaluatorName || sub.assessorName || 'Unknown',
            createdAt: parseDate(sub.createdAt) || new Date(0),
            form: sub.form || {},
            raw: sub,
        }));
        subs.sort((a, b) => b.createdAt - a.createdAt);
        return subs;
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

        // Monthly averages per field (build series for each attribute)
        const monthlyFieldScores = {}; // { 'YYYY-MM': { fieldKey: [scores...] } }
        const fieldSet = new Set();
        filteredSubs.forEach(sub => {
            const submissionDate = parseDate(sub.createdAt);
            if (!submissionDate) return;
            if (submissionDate >= academicYearStart) {
                const monthKey = `${submissionDate.getFullYear()}-${String(submissionDate.getMonth() + 1).padStart(2, '0')}`;
                if (!monthlyFieldScores[monthKey]) monthlyFieldScores[monthKey] = {};
                Object.entries(sub.form || {}).forEach(([field, item]) => {
                    fieldSet.add(field);
                    const score = (item && (typeof item.score === 'number' ? item.score : (typeof item === 'number' ? item : null)));
                    if (score === null || score === undefined) return;
                    if (!monthlyFieldScores[monthKey][field]) monthlyFieldScores[monthKey][field] = [];
                    monthlyFieldScores[monthKey][field].push(score);
                });
            }
        });

        const fieldKeys = Array.from(fieldSet);
        // Build monthlyData array: [{ month: 'YYYY-MM', field1: avg, field2: avg, ... }, ...]
        const monthlyData = Object.entries(monthlyFieldScores)
            .map(([month, fieldMap]) => {
                const entry = { month };
                fieldKeys.forEach(fk => {
                    const arr = fieldMap[fk] || [];
                    entry[fk] = arr.length > 0 ? (arr.reduce((a, b) => a + b, 0) / arr.length) : null;
                });
                return entry;
            })
            .sort((a, b) => a.month.localeCompare(b.month));

        // Get notes from latest 5 submissions (for preview)
        const previewNotes = [];
        filteredSubs.slice(0, 5).forEach(sub => {
            Object.entries(sub.form).forEach(([field, item]) => {
                if (item.note && String(item.note).trim() !== '') {
                    previewNotes.push({
                        note: item.note,
                        field,
                        evaluatorName: sub.evaluatorName || sub.assessorName,
                        createdAt: parseDate(sub.createdAt) || new Date(0),
                    });
                }
            });
        });

    // Build lastForm (entire last submission) to display all attributes and selected scores/values
        const latestSub = filteredSubs[0];
        let lastForm = null;
        if (latestSub && latestSub.form) {
            lastForm = Object.entries(latestSub.form).map(([field, item]) => ({
                field,
                score: item.score !== undefined ? item.score : null,
                value: item.value !== undefined ? item.value : null,
                note: item.note || '',
                raw: item,
            }));
        }

        // Compute overall latestScore as the avg across fields in the latest month (if any)
        let latestScore = 0;
        if (monthlyData.length > 0) {
            const last = monthlyData[monthlyData.length - 1];
            const vals = fieldKeys.map(f => last[f]).filter(v => typeof v === 'number');
            latestScore = vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
        }

        return {
            monthlyData,
            fieldKeys,
            notes: previewNotes.slice(0, 5),
            totalResponses: filteredSubs.length,
            latestScore,
            lastForm,
            latestSubmissionMeta: latestSub ? { evaluatorName: latestSub.evaluatorName || latestSub.assessorName, createdAt: parseDate(latestSub.createdAt) } : null,
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
    const ChartWithLabels = ({ data, fieldKeys }) => {
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
        const colors = [
            '#8884d8','#82ca9d','#ff7300','#38761d','#f44336','#2196f3','#9c27b0','#ffca28','#4caf50','#00acc1'
        ];
        return (
            <Box sx={{ width: '100%', height: isMobile ? 300 : 420, mt: 3, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <ResponsiveContainer>
                    <BarChart data={data} margin={{ top: 8, right: 24, left: 8, bottom: 8 }} barGap={isMobile ? 4 : 6} barCategoryGap={isMobile ? '40%' : '30%'}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                            dataKey="month" 
                            tickFormatter={(value) => {
                                const [year, month] = value.split('-');
                                return `${new Date(year, month - 1).toLocaleString('default', { month: 'short' })}`;
                            }}
                        />
                        <YAxis domain={[0, 5]} label={{ value: 'Rating', angle: -90, position: 'insideLeft', offset: 0 }} />
                        <Tooltip 
                            formatter={(value) => [typeof value === 'number' ? value.toFixed(2) : value, "Rating"]}
                            labelFormatter={(value) => {
                                const [year, month] = value.split('-');
                                return `${new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}`;
                            }}
                        />
                        {!isMobile && <Legend verticalAlign="top" height={36} />}
                        {fieldKeys && fieldKeys.map((fk, idx) => (
                            <Bar key={fk} dataKey={fk} name={kpiFieldLabels[fk] || fk} fill={colors[idx % colors.length]} barSize={isMobile ? 8 : 12} />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </Box>
        );
    };

    // Custom legend for mobile: horizontal scrollable chips
    const MobileLegend = ({ fieldKeys }) => {
        const colors = ['#8884d8','#82ca9d','#ff7300','#38761d','#f44336','#2196f3','#9c27b0','#ffca28','#4caf50','#00acc1'];
        return (
            <Box sx={{ overflowX: 'auto', mt: 1 }}>
                <Stack direction="row" spacing={1} sx={{ minWidth: 320, px: 1 }}>
                    {fieldKeys && fieldKeys.map((fk, idx) => (
                        <Chip key={fk} label={kpiFieldLabels[fk] || fk} size="small" sx={{ bgcolor: colors[idx % colors.length], color: '#fff' }} />
                    ))}
                </Stack>
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
                <ChartWithLabels data={data.monthlyData} fieldKeys={data.fieldKeys} />
                {isMobile && data.fieldKeys && data.fieldKeys.length > 0 && <MobileLegend fieldKeys={data.fieldKeys} />}
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
                        <Typography variant="h6">Latest Submission</Typography>
                        {data.lastForm ? (
                            <List dense>
                                {data.lastForm.map((f, i) => (
                                    <React.Fragment key={f.field + i}>
                                        <ListItem disableGutters>
                                            <ListItemText
                                                primary={<strong>{kpiFieldLabels[f.field] || f.field}</strong>}
                                                secondary={
                                                    <>
                                                        {f.score !== null && <Typography component="span" sx={{ display: 'block' }}>Rating: <strong>{String(f.score)}</strong></Typography>}
                                                        {f.value !== null && <Typography component="span" sx={{ display: 'block' }}>Value: <strong>{String(f.value)}</strong></Typography>}
                                                        {f.note && <Typography component="span" variant="body2" color="text.secondary">Note: {f.note}</Typography>}
                                                    </>
                                                }
                                            />
                                        </ListItem>
                                    </React.Fragment>
                                ))}
                                <ListItem>
                                    <ListItemText primary={`By ${data.latestSubmissionMeta?.evaluatorName || 'Unknown'}`} secondary={data.latestSubmissionMeta?.createdAt ? data.latestSubmissionMeta.createdAt.toLocaleDateString() : ''} />
                                </ListItem>
                            </List>
                        ) : (
                            <Typography>No submissions available.</Typography>
                        )}
                        <Button variant="text" sx={{ mt: 1 }} onClick={() => {
                            setAllNotes(getAllNotes(kpiType));
                            setNotesDialogOpen(true);
                            setNotesPage(1);
                        }}>View All Submissions</Button>
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
                    {paginatedNotes.length > 0 ? (
                        paginatedNotes.map((submission, idx) => (
                            <Paper key={submission.id || idx} sx={{ p: 2, mb: 2 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                    <Typography variant="subtitle1">By {submission.evaluatorName}</Typography>
                                    <Typography variant="caption">{submission.createdAt ? submission.createdAt.toLocaleDateString() : ''}</Typography>
                                </Box>
                                <List dense>
                                    {Object.entries(submission.form || {}).map(([field, item], fi) => (
                                        <ListItem key={field + fi} alignItems="flex-start">
                                            <ListItemText
                                                primary={<strong>{kpiFieldLabels[field] || field}</strong>}
                                                secondary={
                                                    <>
                                                        {item.score !== undefined && <Typography component="span" sx={{ display: 'block' }}>Rating: <strong>{String(item.score)}</strong></Typography>}
                                                        {item.value !== undefined && <Typography component="span" sx={{ display: 'block' }}>Value: <strong>{String(item.value)}</strong></Typography>}
                                                        {item.note && <Typography component="span" variant="body2" color="text.secondary">Note: {String(item.note)}</Typography>}
                                                    </>
                                                }
                                            />
                                        </ListItem>
                                    ))}
                                </List>
                            </Paper>
                        ))
                    ) : (
                        <List><ListItem><ListItemText primary="No submissions found." /></ListItem></List>
                    )}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                        <Button disabled={notesPage === 1} onClick={() => setNotesPage(notesPage - 1)}>Previous</Button>
                        <Typography>Page {notesPage} / {Math.max(1, Math.ceil(allNotes.length / NOTES_PER_PAGE))}</Typography>
                        <Button disabled={notesPage * NOTES_PER_PAGE >= allNotes.length} onClick={() => setNotesPage(notesPage + 1)}>Next</Button>
                    </Box>
                </DialogContent>
            </Dialog>
        </Box>
    );
};

export default MentorDetail;