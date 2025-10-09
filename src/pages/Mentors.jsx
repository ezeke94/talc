import React, { useState, useEffect } from 'react';
import { Box, Card, CardContent, CardActions, Avatar, IconButton, Button, Typography, Fab, useTheme, useMediaQuery, Tooltip, TextField, Chip, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper as MuiPaper } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AddIcon from '@mui/icons-material/Add';
import ModeEditOutlineIcon from '@mui/icons-material/ModeEditOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { db } from '../firebase/config';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import MentorForm from '../components/MentorForm';
import { useAuth } from '../context/AuthContext';

const Mentors = () => {
    const [mentors, setMentors] = useState([]);
    const [search, setSearch] = useState("");
    const [open, setOpen] = useState(false);
    const [currentMentor, setCurrentMentor] = useState(null);
    const [userRole, setUserRole] = useState('');
    const [currentUserFirstName, setCurrentUserFirstName] = useState('');
    const [forms, setForms] = useState([]);
    const [kpiSubmissions, setKpiSubmissions] = useState([]);
    const [centers, setCenters] = useState([]);
    const { currentUser: authUser } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'mentors'), (snapshot) => {
            const mentorData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMentors(mentorData);
        });
        return () => unsubscribe();
    }, []);

    // Load centers for name mapping
    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'centers'), (snapshot) => {
            const centerData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCenters(centerData);
        });
        return () => unsubscribe();
    }, []);

    // Load KPI forms to resolve names for assignedFormIds chips
    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'kpiForms'), (snap) => {
            const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setForms(arr);
        });
        return () => unsub();
    }, []);

    // Load KPI submissions to check form completion status
    useEffect(() => {
        const loadSubmissions = async () => {
            try {
                const now = new Date();
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                
                // Get submissions from current month
                const submissionsSnapshot = await getDocs(
                    query(
                        collection(db, 'kpiSubmissions'),
                        where('createdAt', '>=', startOfMonth)
                    )
                );
                
                const submissions = submissionsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    createdAt: doc.data().createdAt?.toDate() || new Date()
                }));
                
                setKpiSubmissions(submissions);
            } catch (error) {
                console.error('Error loading KPI submissions:', error);
            }
        };
        
        loadSubmissions();
    }, []);

    // Read role and first name from AuthContext (frontend only)
    useEffect(() => {
        if (authUser) {
            const role = (authUser.role || authUser?.role?.toString() || '').toLowerCase();
            setUserRole(role);

            const name = (authUser.name || authUser.displayName || authUser?.email || '') || '';
            const first = name ? name.split(' ')[0].toLowerCase() : '';
            setCurrentUserFirstName(first);
        } else {
            setUserRole('');
            setCurrentUserFirstName('');
        }
    }, [authUser]);

    const handleOpen = (mentor = null) => {
        setCurrentMentor(mentor);
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
        setCurrentMentor(null);
    };

    const handleSave = async (mentorData) => {
        if (currentMentor) {
            await updateDoc(doc(db, 'mentors', currentMentor.id), mentorData);
        } else {
            await addDoc(collection(db, 'mentors'), mentorData);
        }
        handleClose();
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this mentor? This action cannot be undone.")) {
            await deleteDoc(doc(db, 'mentors', id));
        }
    };

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));


    // Map center IDs to names for display
    const getCenterNames = (centerArray) => {
        if (!Array.isArray(centerArray)) return [];
        const centerMap = new Map(centers.map(c => [c.id || c.name, c.name || c.id]));
        return centerArray.map(centerId => centerMap.get(centerId) || centerId);
    };

    // Filter mentors by search
    // Sort mentors alphabetically by name
    const sortedMentors = [...mentors].sort((a, b) => {
        const nameA = a.name?.toLowerCase() || '';
        const nameB = b.name?.toLowerCase() || '';
        return nameA.localeCompare(nameB);
    });
    const filteredMentors = sortedMentors.filter(mentor => {
        const name = mentor.name?.toLowerCase() || "";
        // hide mentor card if mentor's first name matches current user's first name
        const mentorFirst = name.split(' ')[0] || '';
        // Do not hide mentors for evaluator role; only hide when current user is non-evaluator
        if (userRole !== 'evaluator' && currentUserFirstName && mentorFirst === currentUserFirstName) return false;
        // Support both 'center' and 'assignedCenters' (array)
        const centerIds = Array.isArray(mentor.assignedCenters) ? mentor.assignedCenters : (mentor.center ? [mentor.center] : []);
        const centerNames = getCenterNames(centerIds);
        const centerStr = centerNames.join(", ").toLowerCase();
        return name.includes(search.toLowerCase()) || centerStr.includes(search.toLowerCase());
    });

    const getFormNames = (mentor) => {
        const ids = Array.isArray(mentor.assignedFormIds) ? mentor.assignedFormIds : [];
        const nameMap = new Map(forms.map(f => [f.id, f.name]));
        return ids.map(id => nameMap.get(id) || id);
    };

    // Check if a form has been submitted this month for a mentor
    const isFormSubmittedThisMonth = (mentorId, formId) => {
        return kpiSubmissions.some(submission => 
            submission.mentorId === mentorId && 
            (submission.formId === formId || submission.kpiType === forms.find(f => f.id === formId)?.name)
        );
    };

    // Get form chips with color coding
    const getFormChips = (mentor, isDesktop = false) => {
        const ids = Array.isArray(mentor.assignedFormIds) ? mentor.assignedFormIds : [];
        const nameMap = new Map(forms.map(f => [f.id, f.name]));
        
        return ids.map(id => {
            const formName = nameMap.get(id) || id;
            const isSubmitted = isFormSubmittedThisMonth(mentor.id, id);
            
            return (
                <Tooltip 
                    key={id} 
                    title={isSubmitted ? '✓ Submitted this month' : '○ Not submitted this month'}
                    arrow
                    placement="top"
                >
                    <Chip 
                        label={formName} 
                        size={isDesktop ? 'small' : 'medium'}
                        color={isSubmitted ? 'success' : 'default'}
                        variant={isSubmitted ? 'filled' : 'outlined'}
                        onClick={(e) => e.stopPropagation()}
                        sx={{
                            bgcolor: isSubmitted ? 'success.main' : 'background.paper',
                            color: isSubmitted ? 'success.contrastText' : 'text.primary',
                            borderColor: isSubmitted ? 'success.main' : 'divider',
                            fontWeight: isSubmitted ? 600 : 500,
                            fontSize: isDesktop ? '0.75rem' : '0.8125rem',
                            height: isDesktop ? 24 : 32,
                            minHeight: isDesktop ? 24 : 44, // Larger touch target for mobile
                            '&:hover': {
                                bgcolor: isSubmitted ? 'success.dark' : 'grey.100',
                                borderColor: isSubmitted ? 'success.dark' : 'grey.400',
                            },
                            transition: 'all 0.2s ease',
                            boxShadow: isSubmitted ? '0 2px 4px rgba(76, 175, 80, 0.2)' : 'none'
                        }}
                    />
                </Tooltip>
            );
        });
    };

    return (
        <Box sx={{ 
            width: '100%',
            pb: isMobile ? 10 : 0 // Extra padding at bottom for FAB on mobile
        }}>
            <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                mb: { xs: 2, sm: 3 },
                flexWrap: 'wrap',
                gap: 1
            }}>
                <Typography 
                    variant="h4" 
                    sx={{ 
                        fontWeight: 700,
                        fontSize: { xs: '1.5rem', sm: '2rem' }
                    }}
                >
                    Record KPIs
                </Typography>
                {!isMobile && (
                    <Button 
                        variant="contained" 
                        startIcon={<AddIcon />} 
                        onClick={() => handleOpen()} 
                        sx={{ borderRadius: 2 }}
                    >
                        Add Mentor
                    </Button>
                )}
            </Box>
            <Box sx={{ mb: { xs: 2, sm: 3 } }}>
                <TextField
                    fullWidth
                    variant="outlined"
                    placeholder="Search by name or center..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    sx={{
                        '& .MuiOutlineInputBase-root': {
                            borderRadius: { xs: 2, sm: 1 }
                        }
                    }}
                />
            </Box>
            
            {/* Results count for mobile */}
            {isMobile && (
                <Typography 
                    variant="body2" 
                    color="text.secondary" 
                    sx={{ mb: 2, px: 0.5 }}
                >
                    {filteredMentors.length} mentor{filteredMentors.length !== 1 ? 's' : ''} found
                </Typography>
            )}

            {isMobile ? (
                <Box>
                    {filteredMentors.length === 0 ? (
                        <Card sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
                            <Typography variant="h6" color="text.secondary" gutterBottom>
                                No mentors found
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {search ? 'Try adjusting your search' : 'Add your first mentor to get started'}
                            </Typography>
                        </Card>
                    ) : (
                        filteredMentors.map(mentor => {
                            const centerIds = Array.isArray(mentor.assignedCenters) ? mentor.assignedCenters : (mentor.center ? [mentor.center] : []);
                            const centerNames = getCenterNames(centerIds);
                            const formChips = getFormChips(mentor, false);
                            return (
                                <Card
                                    key={mentor.id}
                                    onClick={() => navigate(`/mentor/${mentor.id}`)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') navigate(`/mentor/${mentor.id}`); }}
                                    role="button"
                                    tabIndex={0}
                                    sx={{ 
                                        mb: 1.5, 
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)', 
                                        borderRadius: 2, 
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        '&:hover': {
                                            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                                            transform: 'translateY(-2px)'
                                        },
                                        '&:active': {
                                            transform: 'translateY(0)',
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                                        }
                                    }}
                                >
                                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                        {/* Header: Avatar + Name + Centers + Action Buttons in one row */}
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                                            <Avatar 
                                                sx={{ 
                                                    width: 48, 
                                                    height: 48, 
                                                    bgcolor: 'primary.main',
                                                    color: 'primary.contrastText',
                                                    fontWeight: 700,
                                                    fontSize: '1.25rem',
                                                    flexShrink: 0
                                                }}
                                            >
                                                {mentor.name ? mentor.name.charAt(0).toUpperCase() : '?'}
                                            </Avatar>
                                            
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Typography 
                                                    variant="subtitle1" 
                                                    sx={{ 
                                                        fontWeight: 600,
                                                        fontSize: '1rem',
                                                        lineHeight: 1.3,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                >
                                                    {mentor.name}
                                                </Typography>
                                                {centerNames.length > 0 && (
                                                    <Typography 
                                                        variant="caption" 
                                                        color="text.secondary"
                                                        sx={{ 
                                                            display: 'block',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                            fontSize: '0.75rem'
                                                        }}
                                                    >
                                                        {centerNames.join(", ")}
                                                    </Typography>
                                                )}
                                            </Box>

                                            <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                                                <Tooltip title="Edit">
                                                    <IconButton 
                                                        aria-label="edit" 
                                                        onClick={(e) => { e.stopPropagation(); handleOpen(mentor); }}
                                                        size="small"
                                                        sx={{ 
                                                            width: 50,
                                                            height: 50,
                                                            borderRadius: '50%',
                                                            bgcolor: 'primary.main',
                                                            color: 'white',
                                                            '&:hover': {
                                                                bgcolor: 'primary.dark'
                                                            }
                                                        }}
                                                    >
                                                        <ModeEditOutlineIcon sx={{ fontSize: '1.2rem' }} />
                                                    </IconButton>
                                                </Tooltip>
                                                {userRole !== 'evaluator' && (
                                                    <Tooltip title="Delete">
                                                        <IconButton 
                                                            aria-label="delete" 
                                                            onClick={(e) => { e.stopPropagation(); handleDelete(mentor.id); }}
                                                            size="small"
                                                            sx={{ 
                                                                width: 50,
                                                                height: 50,
                                                                borderRadius: '50%',
                                                                bgcolor: 'error.main',
                                                                color: 'white',
                                                                '&:hover': {
                                                                    bgcolor: 'error.dark'
                                                                }
                                                            }}
                                                        >
                                                            <DeleteOutlineIcon sx={{ fontSize: '1.2rem' }} />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                            </Box>
                                        </Box>

                                        {/* Compact info section: Evaluator + Forms in single row */}
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 1.5 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                                                <Typography 
                                                    variant="caption" 
                                                    color="text.secondary" 
                                                    sx={{ 
                                                        fontWeight: 600,
                                                        textTransform: 'uppercase',
                                                        fontSize: '0.65rem',
                                                        letterSpacing: '0.5px',
                                                        flexShrink: 0
                                                    }}
                                                >
                                                    Evaluator:
                                                </Typography>
                                                <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.875rem' }}>
                                                    {mentor.assignedEvaluator ? mentor.assignedEvaluator.name : 'Not Assigned'}
                                                </Typography>
                                            </Box>

                                            {formChips.length > 0 && (
                                                <Box>
                                                    <Typography 
                                                        variant="caption" 
                                                        color="text.secondary" 
                                                        sx={{ 
                                                            fontWeight: 600,
                                                            textTransform: 'uppercase',
                                                            fontSize: '0.65rem',
                                                            letterSpacing: '0.5px',
                                                            display: 'block',
                                                            mb: 0.5
                                                        }}
                                                    >
                                                        Forms ({formChips.length})
                                                    </Typography>
                                                    <Box 
                                                        onClick={(e) => e.stopPropagation()}
                                                        sx={{ 
                                                            display: 'flex',
                                                            flexWrap: 'wrap',
                                                            gap: 0.5
                                                        }}
                                                    >
                                                        {formChips}
                                                    </Box>
                                                </Box>
                                            )}
                                        </Box>

                                        {/* Evaluate button */}
                                        <Button
                                            variant="outlined"
                                            size="medium"
                                            fullWidth
                                            startIcon={<AssessmentIcon />}
                                            onClick={(e) => { e.stopPropagation(); navigate(`/mentor/${mentor.id}`); }}
                                            sx={{ 
                                                minHeight: 44,
                                                borderRadius: 1.5,
                                                fontWeight: 600,
                                                textTransform: 'none',
                                                fontSize: '0.9375rem',
                                                borderWidth: 2
                                            }}
                                        >
                                            Evaluate
                                        </Button>
                                    </CardContent>
                                </Card>
                            );
                        })
                    )}
                    <Fab 
                        color="primary" 
                        aria-label="add" 
                        onClick={() => handleOpen()} 
                        sx={{ 
                            position: 'fixed', 
                            bottom: { xs: 24, sm: 32 }, 
                            right: { xs: 20, sm: 32 }, 
                            width: { xs: 64, sm: 56 },
                            height: { xs: 64, sm: 56 },
                            zIndex: 1000,
                            boxShadow: '0 4px 20px rgba(123,198,120,0.4)',
                            '&:hover': {
                                boxShadow: '0 6px 24px rgba(123,198,120,0.5)'
                            }
                        }}
                    >
                        <AddIcon sx={{ fontSize: { xs: '2rem', sm: '1.5rem' } }} />
                    </Fab>
                </Box>
            ) : (
                <TableContainer component={MuiPaper} sx={{ mt: 2 }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Centers</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Evaluator</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Assigned Forms</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, width: 180 }}>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredMentors.map(mentor => {
                                const centerIds = Array.isArray(mentor.assignedCenters) ? mentor.assignedCenters : (mentor.center ? [mentor.center] : []);
                                const centerNames = getCenterNames(centerIds);
                                const formChips = getFormChips(mentor, true);
                                return (
                                    <TableRow hover key={mentor.id} sx={{ cursor: 'pointer' }} onClick={() => navigate(`/mentor/${mentor.id}`)}>
                                        <TableCell>
                                            <Stack direction="row" spacing={1.5} alignItems="center">
                                                <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.light', fontWeight: 700 }}>
                                                    {mentor.name ? mentor.name.charAt(0).toUpperCase() : '?'}
                                                </Avatar>
                                                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                                    {mentor.name}
                                                </Typography>
                                            </Stack>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" color="text.secondary">{centerNames.join(', ')}</Typography>
                                        </TableCell>
                                        <TableCell>
                                            {mentor.assignedEvaluator ? (
                                                <Box>
                                                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                                        {mentor.assignedEvaluator.name}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {mentor.assignedEvaluator.role}
                                                    </Typography>
                                                </Box>
                                            ) : (
                                                <Typography variant="body2" color="warning.main" sx={{ fontStyle: 'italic' }}>
                                                    No evaluator assigned
                                                </Typography>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {formChips.length === 0 ? (
                                                <Typography variant="body2" color="text.secondary">—</Typography>
                                            ) : (
                                                <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                                                    {formChips}
                                                </Stack>
                                            )}
                                        </TableCell>
                                        <TableCell align="right">
                                            <Tooltip title="Evaluate">
                                                <IconButton aria-label="evaluate" onClick={(e) => { e.stopPropagation(); navigate(`/mentor/${mentor.id}`); }} size="small">
                                                    <AssessmentIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Edit">
                                                <IconButton aria-label="edit" onClick={(e) => { e.stopPropagation(); handleOpen(mentor); }} size="small">
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            {userRole !== 'evaluator' && (
                                                <Tooltip title="Delete">
                                                    <IconButton aria-label="delete" onClick={(e) => { e.stopPropagation(); handleDelete(mentor.id); }} size="small" color="error">
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
            <MentorForm open={open} onClose={handleClose} onSave={handleSave} mentor={currentMentor} />
        </Box>
    );
};

export default Mentors;