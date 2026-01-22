import React, { useState, useEffect, useMemo } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Chip,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Alert,
    CircularProgress,
    useTheme,
    useMediaQuery,
    ToggleButton,
    ToggleButtonGroup,
} from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { db } from '../firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

const ReportDownload = () => {
    const { currentUser } = useAuth();
    const [mentors, setMentors] = useState([]);
    const [submissions, setSubmissions] = useState([]);
    const [forms, setForms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMonths, setSelectedMonths] = useState([]);
    const [filterType, setFilterType] = useState('mentor');
    const [selectedMentor, setSelectedMentor] = useState('');
    const [selectedForm, setSelectedForm] = useState('');
    const [exporting, setExporting] = useState(false);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const normalizedRole = (currentUser?.role || '').toString().trim().toLowerCase();
    const canAccess = ['admin', 'quality', 'management'].includes(normalizedRole);

    // Generate last 12 months
    const monthOptions = useMemo(() => {
        const months = [];
        const now = new Date();
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const year = d.getFullYear();
            const month = d.getMonth();
            const monthName = d.toLocaleString('default', { month: 'long', year: 'numeric' });
            months.push({ key: `${year}-${String(month + 1).padStart(2, '0')}`, label: monthName });
        }
        return months;
    }, []);

    useEffect(() => {
        const defaultMonths = monthOptions.slice(-2).map(m => m.key);
        setSelectedMonths(defaultMonths);
    }, [monthOptions]);

    useEffect(() => {
        if (!canAccess) {
            setLoading(false);
            return;
        }

        const loadData = async () => {
            setLoading(true);
            try {
                const [mentorsSnap, submissionsSnap, formsSnap] = await Promise.all([
                    getDocs(collection(db, 'mentors')),
                    getDocs(collection(db, 'kpiSubmissions')),
                    getDocs(collection(db, 'kpiForms')),
                ]);

                const mentorsData = mentorsSnap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter(m => (m.status || 'active') !== 'inactive')
                    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

                const submissionsData = submissionsSnap.docs.map(d => ({
                    id: d.id,
                    ...d.data(),
                    createdAt: d.data().createdAt?.toDate() || new Date(),
                }));

                const formsData = formsSnap.docs
                    .map(d => ({ id: d.id, ...d.data() }))
                    .filter(f => !['Intellect', 'Cultural'].includes((f.name || '').trim()))
                    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

                setMentors(mentorsData);
                setSubmissions(submissionsData);
                setForms(formsData);
                setLoading(false);
            } catch (err) {
                console.error('Error loading data:', err);
                setLoading(false);
            }
        };

        loadData();
    }, [canAccess]);

    const handleMonthChange = (e) => {
        setSelectedMonths(Array.isArray(e.target.value) ? e.target.value : []);
    };

    const getSelectedMonthRanges = () => {
        return selectedMonths.map(monthKey => {
            const [year, month] = monthKey.split('-');
            const startDate = new Date(year, parseInt(month) - 1, 1);
            const endDate = new Date(year, parseInt(month), 0, 23, 59, 59);
            return { startDate, endDate, key: monthKey };
        });
    };

    const getMentorsWithSubmissions = useMemo(() => {
        if (selectedMonths.length === 0) return mentors;

        const ranges = getSelectedMonthRanges();
        const mentorIds = new Set();

        submissions.forEach(sub => {
            const subDate = sub.createdAt;
            const inRange = ranges.some(
                range => subDate >= range.startDate && subDate <= range.endDate
            );
            if (inRange) {
                mentorIds.add(sub.mentorId);
            }
        });

        return mentors.filter(m => mentorIds.has(m.id));
    }, [selectedMonths, mentors, submissions]);

    const getFormsWithSubmissions = useMemo(() => {
        if (selectedMonths.length === 0) return forms;

        const ranges = getSelectedMonthRanges();
        const formIds = new Set();

        submissions.forEach(sub => {
            const subDate = sub.createdAt;
            const inRange = ranges.some(
                range => subDate >= range.startDate && subDate <= range.endDate
            );
            if (inRange) {
                formIds.add(sub.formId);
            }
        });

        return forms.filter(f => formIds.has(f.id));
    }, [selectedMonths, forms, submissions]);

    const getMentorSubmissions = useMemo(() => {
        if (!selectedMentor || selectedMonths.length === 0) return [];

        const ranges = getSelectedMonthRanges();
        const result = [];

        submissions.forEach(sub => {
            if (sub.mentorId !== selectedMentor) return;

            const subDate = sub.createdAt;
            const inRange = ranges.some(
                range => subDate >= range.startDate && subDate <= range.endDate
            );

            if (!inRange) return;

            // Determine form - try by formId first, then by kpiType/formName
            let form = forms.find(f => f.id === sub.formId);
            if (!form) {
                form = forms.find(f => f.name === sub.kpiType || f.name === sub.formName);
            }
            if (!form) return;

            // Extract fields from submission.form object
            const submissionFormData = sub.form || {};
            const submissionKeys = Object.keys(submissionFormData);
            
            let fields = [];
            
            // If form has fields array and we have submission data, try to match
            if (form.fields && form.fields.length > 0 && submissionKeys.length > 0) {
                // Try matching form fields to submission keys
                fields = form.fields.map((fieldDef, idx) => {
                    // Try exact key match first
                    let submittedData = submissionFormData[fieldDef.key];
                    
                    // Try label match
                    if (!submittedData) {
                        submittedData = submissionFormData[fieldDef.label];
                    }
                    
                    // Try positional match if keys don't match (same order)
                    if (!submittedData && submissionKeys[idx]) {
                        submittedData = submissionFormData[submissionKeys[idx]];
                    }
                    
                    submittedData = submittedData || {};
                    
                    return {
                        fieldLabel: fieldDef.label || fieldDef.key,
                        score: submittedData.score !== undefined ? submittedData.score : '',
                        note: submittedData.note || '',
                    };
                });
                
                // Check if we got any scores - if not, fall back to submission keys
                const hasAnyScores = fields.some(f => f.score !== '');
                if (!hasAnyScores && submissionKeys.length > 0) {
                    // Use submission keys directly with form labels for display
                    fields = submissionKeys.map((key, idx) => {
                        const data = submissionFormData[key] || {};
                        // Try to find matching form field for better label
                        const formField = form.fields[idx];
                        return {
                            fieldLabel: formField?.label || key,
                            score: data.score !== undefined ? data.score : '',
                            note: data.note || '',
                        };
                    });
                }
            } else if (submissionKeys.length > 0) {
                // No form fields defined, use submission keys directly
                fields = submissionKeys.map(key => {
                    const data = submissionFormData[key] || {};
                    return {
                        fieldLabel: key,
                        score: data.score !== undefined ? data.score : '',
                        note: data.note || '',
                    };
                });
            }

            const dateStr = sub.createdAt.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
            });

            result.push({
                id: sub.id,
                formName: form.name || sub.formName || sub.kpiType,
                date: dateStr,
                fields,
            });
        });

        return result.sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [selectedMentor, selectedMonths, mentors, submissions, forms]);

    const getFormSubmissions = useMemo(() => {
        if (!selectedForm || selectedMonths.length === 0) return [];

        const ranges = getSelectedMonthRanges();
        const result = [];

        submissions.forEach(sub => {
            if (sub.formId !== selectedForm) return;

            const subDate = sub.createdAt;
            const inRange = ranges.some(
                range => subDate >= range.startDate && subDate <= range.endDate
            );

            if (!inRange) return;

            const mentor = mentors.find(m => m.id === sub.mentorId);
            const form = forms.find(f => f.id === sub.formId);

            if (!mentor || !form) return;

            // Extract fields from submission.form object
            const submissionFormData = sub.form || {};
            const submissionKeys = Object.keys(submissionFormData);
            
            let fields = [];
            
            // If form has fields array and we have submission data, try to match
            if (form.fields && form.fields.length > 0 && submissionKeys.length > 0) {
                // Try matching form fields to submission keys
                fields = form.fields.map((fieldDef, idx) => {
                    // Try exact key match first
                    let submittedData = submissionFormData[fieldDef.key];
                    
                    // Try label match
                    if (!submittedData) {
                        submittedData = submissionFormData[fieldDef.label];
                    }
                    
                    // Try positional match if keys don't match (same order)
                    if (!submittedData && submissionKeys[idx]) {
                        submittedData = submissionFormData[submissionKeys[idx]];
                    }
                    
                    submittedData = submittedData || {};
                    
                    return {
                        fieldLabel: fieldDef.label || fieldDef.key,
                        score: submittedData.score !== undefined ? submittedData.score : '',
                        note: submittedData.note || '',
                    };
                });
                
                // Check if we got any scores - if not, fall back to submission keys
                const hasAnyScores = fields.some(f => f.score !== '');
                if (!hasAnyScores && submissionKeys.length > 0) {
                    // Use submission keys directly with form labels for display
                    fields = submissionKeys.map((key, idx) => {
                        const data = submissionFormData[key] || {};
                        // Try to find matching form field for better label
                        const formField = form.fields[idx];
                        return {
                            fieldLabel: formField?.label || key,
                            score: data.score !== undefined ? data.score : '',
                            note: data.note || '',
                        };
                    });
                }
            } else if (submissionKeys.length > 0) {
                // No form fields defined, use submission keys directly
                fields = submissionKeys.map(key => {
                    const data = submissionFormData[key] || {};
                    return {
                        fieldLabel: key,
                        score: data.score !== undefined ? data.score : '',
                        note: data.note || '',
                    };
                });
            }

            const dateStr = sub.createdAt.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
            });

            result.push({
                id: sub.id,
                mentorName: mentor.name,
                date: dateStr,
                fields,
            });
        });

        return result.sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [selectedForm, selectedMonths, mentors, submissions, forms]);

    // Auto-select first mentor with submissions when months/mentors change
    useEffect(() => {
        const mentorsWithSubs = getMentorsWithSubmissions;
        if (mentorsWithSubs.length > 0 && (!selectedMentor || !mentorsWithSubs.find(m => m.id === selectedMentor))) {
            setSelectedMentor(mentorsWithSubs[0].id);
        } else if (mentorsWithSubs.length === 0) {
            setSelectedMentor('');
        }
    }, [selectedMonths, mentors, submissions, selectedMentor, getMentorsWithSubmissions]);

    // Auto-select first form with submissions when months/forms change
    useEffect(() => {
        const formsWithSubs = getFormsWithSubmissions;
        if (formsWithSubs.length > 0 && (!selectedForm || !formsWithSubs.find(f => f.id === selectedForm))) {
            setSelectedForm(formsWithSubs[0].id);
        } else if (formsWithSubs.length === 0) {
            setSelectedForm('');
        }
    }, [selectedMonths, forms, submissions, selectedForm, getFormsWithSubmissions]);

    const handleExportPDF = () => {
        setExporting(true);
        try {
            const mentorName = mentors.find(m => m.id === selectedMentor)?.name || 'Selected Mentor';
            const formName = forms.find(f => f.id === selectedForm)?.name || 'Selected Form';
            const monthLabels = selectedMonths
                .map(monthKey => monthOptions.find(m => m.key === monthKey)?.label)
                .filter(Boolean)
                .join(', ');

            const data = filterType === 'mentor' ? mentorSubmissions : formSubmissions;
            const title = filterType === 'mentor'
                ? `KPI Report - ${mentorName}`
                : `KPI Report - ${formName}`;

            let html = `
                <html>
                <head>
                    <title>${title}</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        h1 { color: #333; }
                        h3 { color: #666; margin-top: 20px; }
                        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f5f5f5; font-weight: bold; }
                    </style>
                </head>
                <body>
                    <h1>${title}</h1>
                    <p>Period: ${monthLabels}</p>
            `;

            if (data.length === 0) {
                html += '<p>No submissions found for selected criteria.</p>';
            } else {
                data.forEach(submission => {
                    const submissionTitle = filterType === 'mentor' ? submission.formName : submission.mentorName;
                    html += `
                        <h3>${submissionTitle} - ${submission.date}</h3>
                        <table>
                            <tr>
                                <th>Field</th>
                                <th>Score</th>
                                <th>Note</th>
                            </tr>
                    `;
                    submission.fields.forEach(field => {
                        html += `
                            <tr>
                                <td>${field.fieldLabel}</td>
                                <td>${field.score || '-'}</td>
                                <td>${field.note || '-'}</td>
                            </tr>
                        `;
                    });
                    html += '</table>';
                });
            }

            html += '</body></html>';

            const newWin = window.open('', '_blank');
            if (!newWin) {
                alert('Pop-up blocked. Please allow pop-ups for this site to export the PDF.');
                setExporting(false);
                return;
            }
            newWin.document.write(html);
            newWin.document.close();
            // Wait for content to render, then trigger print
            setTimeout(() => {
                newWin.focus();
                newWin.print();
                setExporting(false);
            }, 300);
        } catch (err) {
            console.error('Export failed', err);
            alert('Failed to export report.');
            setExporting(false);
        }
    };

    if (!canAccess) {
        return (
            <Alert severity="warning" sx={{ mt: 3 }}>
                You do not have access to view reports.
            </Alert>
        );
    }

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    const mentorSubmissions = getMentorSubmissions;
    const formSubmissions = getFormSubmissions;

    return (
        <Box sx={{ maxWidth: 1200, mx: 'auto', p: { xs: 2, md: 3 } }}>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: { xs: 2, md: 3 }, fontSize: { xs: '1.5rem', md: '2rem' } }}>
                KPI Reports
            </Typography>

            {/* Month Selection */}
            <Card sx={{ mb: { xs: 2, md: 3 } }}>
                <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, display: { xs: 'block', md: 'none' } }}>
                        Select Months
                    </Typography>
                    <FormControl fullWidth sx={{ maxWidth: { xs: '100%', md: 400 } }}>
                        <InputLabel sx={{ display: { xs: 'none', md: 'block' } }}>Select Months</InputLabel>
                        <Select
                            multiple
                            value={Array.isArray(selectedMonths) ? selectedMonths : []}
                            onChange={handleMonthChange}
                            label={isMobile ? '' : 'Select Months'}
                            renderValue={(selected) => (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    {selected.map((value) => {
                                        const monthLabel = monthOptions.find(m => m.key === value)?.label;
                                        return <Chip key={value} label={monthLabel} size="small" />;
                                    })}
                                </Box>
                            )}
                            sx={{ fontSize: { xs: '0.875rem', md: '1rem' } }}
                        >
                            {monthOptions.map(month => (
                                <MenuItem key={month.key} value={month.key}>
                                    {month.label}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </CardContent>
            </Card>

            {/* Filter Type Selection */}
            <Card sx={{ mb: { xs: 2, md: 3 } }}>
                <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, fontSize: { xs: '1rem', md: '1.25rem' } }}>
                        Filter By
                    </Typography>
                    <ToggleButtonGroup
                        value={filterType}
                        exclusive
                        onChange={(e, newValue) => newValue && setFilterType(newValue)}
                        sx={{ 
                            mb: 2,
                            width: { xs: '100%', md: 'auto' },
                            display: 'flex',
                            '& .MuiToggleButton-root': {
                                flex: { xs: 1, md: 'initial' },
                                fontSize: { xs: '0.875rem', md: '1rem' },
                                py: { xs: 1, md: 1.5 }
                            }
                        }}
                    >
                        <ToggleButton value="mentor">Mentor Name</ToggleButton>
                        <ToggleButton value="form">Form Name</ToggleButton>
                    </ToggleButtonGroup>

                    {filterType === 'mentor' ? (
                        <FormControl fullWidth sx={{ mb: 2, maxWidth: { xs: '100%', md: 400 } }}>
                            <InputLabel>Select Mentor</InputLabel>
                            <Select
                                value={selectedMentor}
                                onChange={(e) => setSelectedMentor(e.target.value)}
                                label="Select Mentor"
                                sx={{ fontSize: { xs: '0.875rem', md: '1rem' } }}
                            >
                                {getMentorsWithSubmissions.map(mentor => (
                                    <MenuItem key={mentor.id} value={mentor.id}>
                                        {mentor.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    ) : (
                        <FormControl fullWidth sx={{ mb: 2, maxWidth: { xs: '100%', md: 400 } }}>
                            <InputLabel>Select Form</InputLabel>
                            <Select
                                value={selectedForm}
                                onChange={(e) => setSelectedForm(e.target.value)}
                                label="Select Form"
                                sx={{ fontSize: { xs: '0.875rem', md: '1rem' } }}
                            >
                                {getFormsWithSubmissions.map(form => (
                                    <MenuItem key={form.id} value={form.id}>
                                        {form.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}

                    <Box>
                        <Button
                            variant="contained"
                            startIcon={<PictureAsPdfIcon />}
                            onClick={handleExportPDF}
                            disabled={(Array.isArray(selectedMonths) ? selectedMonths.length === 0 : true) || exporting}
                            fullWidth={isMobile}
                            sx={{ 
                                borderRadius: 2,
                                fontSize: { xs: '0.875rem', md: '1rem' },
                                py: { xs: 1.25, md: 1.5 }
                            }}
                        >
                            {exporting ? 'Exporting...' : 'Export as PDF'}
                        </Button>
                    </Box>
                </CardContent>
            </Card>

            {/* Results Display */}
            <Card>
                <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, fontSize: { xs: '1rem', md: '1.25rem' } }}>
                        {filterType === 'mentor'
                            ? `Submissions for ${mentors.find(m => m.id === selectedMentor)?.name || 'Selected Mentor'}`
                            : `Submissions for ${forms.find(f => f.id === selectedForm)?.name || 'Selected Form'}`}
                    </Typography>

                    {filterType === 'mentor' ? (
                        mentorSubmissions.length === 0 ? (
                            <Typography color="text.secondary" sx={{ fontSize: { xs: '0.875rem', md: '1rem' } }}>
                                No submissions found for selected criteria
                            </Typography>
                        ) : (
                            <Stack spacing={{ xs: 1.5, md: 2 }}>
                                {mentorSubmissions.map((submission) => (
                                    <Card key={submission.id} variant="outlined" sx={{ boxShadow: { md: 1 } }}>
                                        <CardContent sx={{ p: { xs: 2, md: 3 }, '&:last-child': { pb: { xs: 2, md: 3 } } }}>
                                            <Typography 
                                                variant="subtitle2" 
                                                sx={{ 
                                                    fontWeight: 600, 
                                                    mb: 2,
                                                    fontSize: { xs: '0.875rem', md: '1rem' }
                                                }}
                                            >
                                                {submission.formName} - {submission.date}
                                            </Typography>
                                            
                                            {/* Mobile View - Card-based layout */}
                                            {isMobile ? (
                                                <Stack spacing={1.5}>
                                                    {submission.fields.map((field, idx) => (
                                                        <Box 
                                                            key={idx}
                                                            sx={{ 
                                                                p: 1.5, 
                                                                bgcolor: 'grey.50', 
                                                                borderRadius: 1,
                                                                border: '1px solid',
                                                                borderColor: 'grey.200'
                                                            }}
                                                        >
                                                            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                                                {field.fieldLabel}
                                                            </Typography>
                                                            <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                                                                <Box>
                                                                    <Typography variant="caption" color="text.secondary">
                                                                        Score
                                                                    </Typography>
                                                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                                        {field.score || '-'}
                                                                    </Typography>
                                                                </Box>
                                                                <Box sx={{ flex: 1 }}>
                                                                    <Typography variant="caption" color="text.secondary">
                                                                        Note
                                                                    </Typography>
                                                                    <Typography variant="body2">
                                                                        {field.note || '-'}
                                                                    </Typography>
                                                                </Box>
                                                            </Box>
                                                        </Box>
                                                    ))}
                                                </Stack>
                                            ) : (
                                                /* Desktop View - Table layout */
                                                <TableContainer>
                                                    <Table size="small">
                                                        <TableHead>
                                                            <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                                                                <TableCell sx={{ fontWeight: 600 }}>Field</TableCell>
                                                                <TableCell sx={{ fontWeight: 600, width: '100px' }}>Score</TableCell>
                                                                <TableCell sx={{ fontWeight: 600 }}>Note</TableCell>
                                                            </TableRow>
                                                        </TableHead>
                                                        <TableBody>
                                                            {submission.fields.map((field, idx) => (
                                                                <TableRow key={idx}>
                                                                    <TableCell>{field.fieldLabel}</TableCell>
                                                                    <TableCell sx={{ textAlign: 'center' }}>
                                                                        {field.score || '-'}
                                                                    </TableCell>
                                                                    <TableCell>{field.note || '-'}</TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </TableContainer>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                            </Stack>
                        )
                    ) : (
                        formSubmissions.length === 0 ? (
                            <Typography color="text.secondary" sx={{ fontSize: { xs: '0.875rem', md: '1rem' } }}>
                                No submissions found for selected criteria
                            </Typography>
                        ) : (
                            <Stack spacing={{ xs: 1.5, md: 2 }}>
                                {formSubmissions.map((submission) => (
                                    <Card key={submission.id} variant="outlined" sx={{ boxShadow: { md: 1 } }}>
                                        <CardContent sx={{ p: { xs: 2, md: 3 }, '&:last-child': { pb: { xs: 2, md: 3 } } }}>
                                            <Typography 
                                                variant="subtitle2" 
                                                sx={{ 
                                                    fontWeight: 600, 
                                                    mb: 2,
                                                    fontSize: { xs: '0.875rem', md: '1rem' }
                                                }}
                                            >
                                                {submission.mentorName} - {submission.date}
                                            </Typography>
                                            
                                            {/* Mobile View - Card-based layout */}
                                            {isMobile ? (
                                                <Stack spacing={1.5}>
                                                    {submission.fields.map((field, idx) => (
                                                        <Box 
                                                            key={idx}
                                                            sx={{ 
                                                                p: 1.5, 
                                                                bgcolor: 'grey.50', 
                                                                borderRadius: 1,
                                                                border: '1px solid',
                                                                borderColor: 'grey.200'
                                                            }}
                                                        >
                                                            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                                                {field.fieldLabel}
                                                            </Typography>
                                                            <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                                                                <Box>
                                                                    <Typography variant="caption" color="text.secondary">
                                                                        Score
                                                                    </Typography>
                                                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                                        {field.score || '-'}
                                                                    </Typography>
                                                                </Box>
                                                                <Box sx={{ flex: 1 }}>
                                                                    <Typography variant="caption" color="text.secondary">
                                                                        Note
                                                                    </Typography>
                                                                    <Typography variant="body2">
                                                                        {field.note || '-'}
                                                                    </Typography>
                                                                </Box>
                                                            </Box>
                                                        </Box>
                                                    ))}
                                                </Stack>
                                            ) : (
                                                /* Desktop View - Table layout */
                                                <TableContainer>
                                                    <Table size="small">
                                                        <TableHead>
                                                            <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                                                                <TableCell sx={{ fontWeight: 600 }}>Field</TableCell>
                                                                <TableCell sx={{ fontWeight: 600, width: '100px' }}>Score</TableCell>
                                                                <TableCell sx={{ fontWeight: 600 }}>Note</TableCell>
                                                            </TableRow>
                                                        </TableHead>
                                                        <TableBody>
                                                            {submission.fields.map((field, idx) => (
                                                                <TableRow key={idx}>
                                                                    <TableCell>{field.fieldLabel}</TableCell>
                                                                    <TableCell sx={{ textAlign: 'center' }}>
                                                                        {field.score || '-'}
                                                                    </TableCell>
                                                                    <TableCell>{field.note || '-'}</TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </TableContainer>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))}
                            </Stack>
                        )
                    )}
                </CardContent>
            </Card>
        </Box>
    );
};

export default ReportDownload;
