import React, { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import { Box, Typography, Paper, ToggleButton, ToggleButtonGroup, Autocomplete, TextField, CircularProgress, Dialog, DialogTitle, List, ListItem, ListItemText, Container } from '@mui/material';
import KPIChart from '../components/KPIChart';
import { centers } from '../utils/seedData';
import { useAuth } from '../context/AuthContext';

const scoreToCategory = (score) => {
    if (score === 0 || !score) return "N/A";
    if (score < 1.5) return "Critical";
    if (score < 2.5) return "Not Up to Expectation";
    if (score < 3.5) return "As Expected";
    if (score < 4.5) return "Shows Intention";
    return "Exceeds Expectations / Exceptional";
};

const Dashboard = () => {
    const { currentUser } = useAuth();
    const [kpiType, setKpiType] = useState('Intellect');
    const [forms, setForms] = useState([]); // dynamic forms
    const [centerFilter, setCenterFilter] = useState(null);
    const [chartData, setChartData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [allMentors, setAllMentors] = useState([]);
    const [allSubmissions, setAllSubmissions] = useState([]);
    
    const [modalOpen, setModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalMentors, setModalMentors] = useState([]);

    // Check if user has dashboard access
    const userRole = (currentUser?.role || '').trim().toLowerCase();
    const canViewDashboard = ['admin', 'quality'].includes(userRole);

    // If user doesn't have dashboard access, show access denied
    if (!canViewDashboard) {
        return (
            <Container maxWidth="lg" sx={{ px: { xs: 1, sm: 2, md: 3 } }}>
                <Paper elevation={3} sx={{ borderRadius: { xs: 2, sm: 3 }, p: 4, textAlign: 'center' }}>
                    <Typography variant="h5" color="error" gutterBottom>
                        Access Denied
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        You don't have permission to view dashboards. Only Admin and Quality roles can access this page.
                    </Typography>
                </Paper>
            </Container>
        );
    }

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const mentorsSnapshot = await getDocs(collection(db, 'mentors'));
                const mentorsData = mentorsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setAllMentors(mentorsData);

                const submissionsSnapshot = await getDocs(collection(db, 'kpiSubmissions'));
                const subsData = submissionsSnapshot.docs.map(doc => ({ 
                    id: doc.id, 
                    ...doc.data(),
                    // Ensure createdAt is a Date object
                    createdAt: doc.data().createdAt?.toDate() || new Date()
                }));
                setAllSubmissions(subsData);

                // Load available KPI forms
                try {
                    const formsSnap = await getDocs(collection(db, 'kpiForms'));
                    const formsData = formsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                    setForms(formsData);
                    // Keep existing default if still available; else fallback to first
                    if (formsData.length > 0) {
                        const hasCurrent = formsData.some(f => f.name === kpiType);
                        if (!hasCurrent) {
                            // Prefer Intellect/Cultural if present; otherwise first form
                            const preferred = ['Intellect', 'Cultural'].find(n => formsData.some(f => f.name === n));
                            setKpiType(preferred || formsData[0].name);
                        }
                    }
                } catch (e) {
                    // forms collection may not exist yet; ignore
                }
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        if (loading) return;

        try {
            // Filter mentors by center if centerFilter is set.
            // Support both the newer `assignedCenters` (array) and legacy `center` (string).
            let filteredMentors = centerFilter
                ? allMentors.filter(m => {
                    const centers = Array.isArray(m.assignedCenters)
                        ? m.assignedCenters
                        : (m.center ? [m.center] : []);
                    return centers.includes(centerFilter);
                })
                : allMentors;

            const latestScores = filteredMentors.map(mentor => {
                // Filter submissions for this mentor and KPI type
                const mentorSubs = allSubmissions
                    .filter(s => {
                        if (s.mentorId !== mentor.id) return false;
                        // Legacy submissions use s.kpiType === 'Intellect' | 'Cultural'
                        // New submissions may use s.formName or s.kpiType matching a dynamic form name
                        const formName = s.formName || s.kpiType;
                        return formName === kpiType;
                    })
                    .sort((a, b) => b.createdAt - a.createdAt);

                if (mentorSubs.length === 0) {
                    return { ...mentor, category: 'N/A', score: 0 };
                }
                
                const latestSub = mentorSubs[0];
                
                // Calculate average score correctly
                const formFields = Object.values(latestSub.form || {});
                if (formFields.length === 0) {
                    return { ...mentor, category: 'N/A', score: 0 };
                }

                const validScores = formFields
                    .map(field => Number(field.score))
                    .filter(score => !isNaN(score) && score > 0);
                    
                if (validScores.length === 0) {
                    return { ...mentor, category: 'N/A', score: 0 };
                }

                const avgScore = validScores.reduce((a, b) => a + b, 0) / validScores.length;
                
                return { 
                    ...mentor, 
                    category: scoreToCategory(avgScore),
                    score: avgScore 
                };
            });

            // Filter out N/A entries and group by category
            const categoryCounts = {};
            const validCategories = [
                "Critical",
                "Not Up to Expectation",
                "As Expected",
                "Shows Intention",
                "Exceeds Expectations / Exceptional"
            ];

            validCategories.forEach(category => {
                const mentorsInCategory = latestScores.filter(m => m.category === category);
                if (mentorsInCategory.length > 0) {
                    categoryCounts[category] = mentorsInCategory;
                }
            });

            // Transform into chart data format with proper sorting
            const dataForChart = Object.entries(categoryCounts)
                .map(([name, mentors]) => ({
                    name,
                    value: mentors.length,
                    mentors: mentors.map(m => `${m.name} (${m.score.toFixed(1)})`)
                }));
            
            console.log('Chart Data:', dataForChart); // Debug output
            setChartData(dataForChart);

        } catch (error) {
            console.error("Error processing data:", error);
            setChartData([]);
        }

    }, [kpiType, centerFilter, allMentors, allSubmissions, loading]);

    const handleChartClick = (data) => {
        setModalTitle(`Mentors in "${data.name}"`);
        setModalMentors(data.mentors);
        setModalOpen(true);
    };

    return (
        <Box>
            <Typography variant="h4" gutterBottom>KPI Dashboard</Typography>
            <Paper sx={{ p: 2, display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'flex-end', alignItems: 'center', mb: 3 }}>
                <TextField
                    select
                    label="KPI Form"
                    value={kpiType}
                    onChange={e => setKpiType(e.target.value)}
                    SelectProps={{ native: true }}
                    sx={{ minWidth: 220 }}
                    InputLabelProps={{ shrink: true }}
                >
                    {forms.map(f => (
                        <option key={f.id} value={f.name}>{f.name}</option>
                    ))}
                </TextField>
                <Box sx={{ minWidth: 220 }}>
                    <TextField
                        select
                        label="Filter by Center"
                        value={centerFilter || ''}
                        onChange={e => setCenterFilter(e.target.value || null)}
                        SelectProps={{ native: true }}
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                    >
                        <option value="">All Centers</option>
                        {centers.map(center => (
                            <option key={center} value={center}>{center}</option>
                        ))}
                    </TextField>
                </Box>
            </Paper>

            <Paper sx={{ p: 2 }}>
                <Typography variant="h6">Average Mentor Score Distribution</Typography>
                {loading ? (
                    <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                        <CircularProgress />
                    </Box>
                ) : chartData.length === 0 ? (
                    <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                        <Typography color="text.secondary">
                            No data available for the selected filters
                        </Typography>
                    </Box>
                ) : (
                    <KPIChart data={chartData} onSegmentClick={handleChartClick} />
                )}
            </Paper>

            <Dialog onClose={() => setModalOpen(false)} open={modalOpen}>
                <DialogTitle>{modalTitle}</DialogTitle>
                <List sx={{ pt: 0 }}>
                    {modalMentors.map((name) => (
                        <ListItem key={name}>
                            <ListItemText primary={name} />
                        </ListItem>
                    ))}
                </List>
            </Dialog>
        </Box>
    );
};

export default Dashboard; // Component name remains for routing, but UI is 'KPI Dashboard'