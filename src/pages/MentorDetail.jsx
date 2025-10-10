import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase/config';
import { doc, getDoc, collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { Box, Typography, Button, Paper, CircularProgress, List, ListItem, ListItemText, Divider, Grid, Dialog, DialogTitle, DialogContent, IconButton, Card, CardContent, Avatar, useTheme, useMediaQuery, Skeleton, Fade, Collapse, Tabs, Tab, Chip, Stack } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList, ResponsiveContainer } from 'recharts';
// ...existing code...
import KPIScoreScale from '../components/KPIScoreScale';
import { kpiFieldLabels } from '../constants/kpiFields';
import { collection as fsCollection, getDocs } from 'firebase/firestore';

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
    const [availableForms, setAvailableForms] = useState([]); // all forms from kpiForms
    const NOTES_PER_PAGE = 10;
    const theme = useTheme();
    const [isMobile, setIsMobile] = useState(false);

    // More reliable mobile detection for Safari and Opera
    useEffect(() => {
        const checkMobile = () => {
            const width = window.innerWidth;
            setIsMobile(width < theme.breakpoints.values.md);
        };
        
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, [theme.breakpoints.values.md]);
    const intellectRef = useRef(null);
    const culturalRef = useRef(null);

    // Labels imported from shared constants

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

    // Load available dynamic forms
    useEffect(() => {
        (async () => {
            try {
                const snap = await getDocs(fsCollection(db, 'kpiForms'));
                const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                setAvailableForms(arr);
            } catch (e) {
                // ignore if forms collection not present
                setAvailableForms([]);
            }
        })();
    }, []);

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
        const filteredSubs = submissions.filter(s => (s.formName || s.kpiType) === kpiType);
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
        const filteredSubs = submissions.filter(s => (s.formName || s.kpiType) === kpiType);
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

    // Determine which forms to show for this mentor: use Firestore-assigned forms only
    const assignedFormIds = Array.isArray(mentor?.assignedFormIds) ? mentor.assignedFormIds : [];
    const dynamicAssignedForms = availableForms.filter(f => assignedFormIds.includes(f.id));
    const uniqueFormNames = dynamicAssignedForms.map(f => f.name);
    const dataByFormName = Object.fromEntries(uniqueFormNames.map(n => [n, getKpiData(n)]));

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
                        <YAxis domain={[0, 5]} ticks={[0,1,2,3,4,5]} tickFormatter={(v) => String(v)} tick={{ fontSize: 12 }} label={{ value: 'Rating', angle: -90, position: 'insideLeft', offset: 0 }} />
                        {/* Hover tooltip disabled; we show values as labels on top of bars instead */}
                        {fieldKeys && fieldKeys.map((fk, idx) => (
                            <Bar 
                                key={fk} 
                                dataKey={fk} 
                                name={kpiFieldLabels[fk] || fk} 
                                fill={colors[idx % colors.length]} 
                                barSize={isMobile ? 8 : 12}
                                cursor="default"
                                onMouseEnter={() => {}} 
                                onMouseLeave={() => {}}
                            >
                                    {!isMobile && (
                                        <LabelList dataKey={fk} position="top" formatter={(v) => (typeof v === 'number' ? v.toFixed(1) : '')} style={{ fontSize: 10, fill: '#222' }} dy={-6} />
                                    )}
                            </Bar>
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
                <Stack direction="row" spacing={1} sx={{ px: 1 }}>
                    {fieldKeys && fieldKeys.map((fk, idx) => (
                        <Chip key={fk} label={kpiFieldLabels[fk] || fk} size="small" sx={{ bgcolor: colors[idx % colors.length], color: '#fff', fontWeight: 700, fontSize: '0.85rem' }} />
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
                {data.fieldKeys && data.fieldKeys.length > 0 && <MobileLegend fieldKeys={data.fieldKeys} />}
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
                {/* Inline form buttons removed — use the fixed quick-action buttons instead */}
            </Paper>
        </Fade>
    );

    // Notes dialog for viewing all notes
    const paginatedNotes = allNotes.slice((notesPage - 1) * NOTES_PER_PAGE, notesPage * NOTES_PER_PAGE);

    return (
        <Box sx={{ pb: isMobile ? 14 : 4 }}>
            {/* Minimal header: only mentor name */}
            <Fade in timeout={500}>
                <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'space-between' }}>
                    <Box>
                        <Typography variant="h4" sx={{ fontWeight: 700 }}>{mentor.name}</Typography>
                    </Box>
                    {!isMobile && (
                        <Tabs value={activeKpiTab} onChange={(_, v) => setActiveKpiTab(v)} sx={{ ml: 2 }}>
                            {uniqueFormNames.map(name => (
                                <Tab key={name} label={`${name} KPI`} />
                            ))}
                        </Tabs>
                    )}
                </Box>
            </Fade>

            {/* KPI Section Tabs for mobile only (desktop tabs live in the header) */}
            {isMobile && (
                <Tabs value={activeKpiTab} onChange={(_, v) => setActiveKpiTab(v)} variant="scrollable" scrollButtons allowScrollButtonsMobile sx={{ mb: 2 }}>
                    {uniqueFormNames.map(name => (
                        <Tab key={name} label={`${name} KPI`} />
                    ))}
                </Tabs>
            )}

            {/* Render only the active tab's section (desktop now matches mobile behavior) */}
            {uniqueFormNames.length === 0 && (
                <Paper sx={{ p: 2, mt: 2 }}>
                    <Typography color="text.secondary">No forms assigned to this mentor.</Typography>
                </Paper>
            )}
            {uniqueFormNames.map((name, idx) => (
                activeKpiTab === idx ? (
                    <Box key={name}>
                        <KPISection title={`${name} KPI`} data={dataByFormName[name]} formType={name.toLowerCase()} kpiType={name} />
                    </Box>
                ) : null
            ))}

    

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

            {/* Fixed quick actions to open forms — show only the button matching the visible section/tab */}
            {mentor && uniqueFormNames.length > 0 && (() => {
                const activeName = uniqueFormNames[activeKpiTab];
                if (!activeName) return null;
                const dynamicForm = availableForms.find(f => f.name === activeName);
                // Always use dynamic route for assigned forms (forms come from Firestore)
                const onClick = () => {
                    if (dynamicForm) {
                        navigate(`/mentor/${mentorId}/fill/${dynamicForm.id}`);
                    }
                };
                return (
                    <Box sx={isMobile ? {
                        position: 'fixed', left: 0, right: 0, bottom: 0, p: 2, bgcolor: 'background.paper', boxShadow: 6, zIndex: 1200,
                    } : {
                        position: 'fixed', bottom: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 1, zIndex: 1200,
                    }}>
                        <Button
                            aria-label={`Fill ${activeName} Form`}
                            variant="contained"
                            color={'secondary'}
                            onClick={onClick}
                            fullWidth={isMobile}
                            sx={isMobile ? {} : { minWidth: 200 }}
                        >
                            {`Fill ${activeName} Form`}
                        </Button>
                    </Box>
                );
            })()}
        </Box>
    );
};

export default MentorDetail;