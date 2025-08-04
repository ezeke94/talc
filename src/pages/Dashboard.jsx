import React, { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import { Box, Typography, Paper, ToggleButton, ToggleButtonGroup, Autocomplete, TextField, CircularProgress, Dialog, DialogTitle, List, ListItem, ListItemText } from '@mui/material';
import KPIChart from '../components/KPIChart';
import { centers } from '../utils/seedData';

const scoreToCategory = (score) => {
    if (score === 0 || !score) return "N/A";
    if (score < 1.5) return "Critical";
    if (score < 2.5) return "Not Up to Expectation";
    if (score < 3.5) return "As Expected";
    if (score < 4.5) return "Shows Intention";
    return "Exceeds Expectations / Exceptional";
};

const Dashboard = () => {
    const [kpiType, setKpiType] = useState('Intellect');
    const [centerFilter, setCenterFilter] = useState(null);
    const [chartData, setChartData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [allMentors, setAllMentors] = useState([]);
    const [allSubmissions, setAllSubmissions] = useState([]);
    
    const [modalOpen, setModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalMentors, setModalMentors] = useState([]);

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
            // Filter mentors by center if centerFilter is set
            let filteredMentors = centerFilter 
                ? allMentors.filter(m => m.center === centerFilter) 
                : allMentors;

            const latestScores = filteredMentors.map(mentor => {
                // Filter submissions for this mentor and KPI type
                const mentorSubs = allSubmissions
                    .filter(s => s.mentorId === mentor.id && s.kpiType === kpiType)
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

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                <CircularProgress />
            </Box>
        );
    }

    if (chartData.length === 0) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                <Typography color="text.secondary">
                    No data available for the selected filters
                </Typography>
            </Box>
        );
    }

    return (
        <Box>
            <Typography variant="h4" gutterBottom>Dashboard</Typography>
            <Paper sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <ToggleButtonGroup
                    color="primary"
                    value={kpiType}
                    exclusive
                    onChange={(e, newType) => newType && setKpiType(newType)}
                >
                    <ToggleButton value="Intellect">Intellect KPI</ToggleButton>
                    <ToggleButton value="Cultural">Cultural KPI</ToggleButton>
                </ToggleButtonGroup>
                
                <Autocomplete
                    options={centers}
                    sx={{ width: 300 }}
                    value={centerFilter}
                    onChange={(e, newValue) => setCenterFilter(newValue)}
                    renderInput={(params) => <TextField {...params} label="Filter by Center" />}
                />
            </Paper>

            <Paper sx={{ p: 2 }}>
                <Typography variant="h6">Average Mentor Score Distribution</Typography>
                <KPIChart data={chartData} onSegmentClick={handleChartClick} />
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

export default Dashboard;