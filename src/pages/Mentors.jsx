import React, { useState, useEffect } from 'react';
import { Box, Card, CardContent, CardActions, Avatar, IconButton, Button, Typography, Fab, useTheme, useMediaQuery, Tooltip, TextField, Chip, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper as MuiPaper } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AddIcon from '@mui/icons-material/Add';
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
    const { currentUser: authUser } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'mentors'), (snapshot) => {
            const mentorData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMentors(mentorData);
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
        const centers = Array.isArray(mentor.assignedCenters) ? mentor.assignedCenters : (mentor.center ? [mentor.center] : []);
        const centerStr = centers.join(", ").toLowerCase();
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
                    title={isSubmitted ? 'Submitted this month' : 'Not submitted this month'}
                    arrow
                >
                    <Chip 
                        label={formName} 
                        size="small"
                        color={isSubmitted ? 'success' : 'default'}
                        variant={isSubmitted ? 'filled' : 'outlined'}
                        onClick={(e) => e.stopPropagation()}
                        sx={{
                            bgcolor: isSubmitted ? 'success.main' : 'grey.300',
                            color: isSubmitted ? 'success.contrastText' : 'text.primary',
                            '&:hover': {
                                bgcolor: isSubmitted ? 'success.dark' : 'grey.400',
                            },
                            ...(isDesktop && {
                                fontSize: '0.75rem',
                                height: '24px'
                            })
                        }}
                    />
                </Tooltip>
            );
        });
    };

    return (
        <Box sx={{ width: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>Manage Mentors</Typography>
                {!isMobile && (
                    <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()} sx={{ borderRadius: 2 }}>
                        Add Mentor
                    </Button>
                )}
            </Box>
            <Box sx={{ mb: 2 }}>
                <TextField
                    fullWidth
                    variant="outlined"
                    placeholder="Search by name or center..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </Box>

            {isMobile ? (
                <Box>
                    {filteredMentors.map(mentor => {
                        const centers = Array.isArray(mentor.assignedCenters) ? mentor.assignedCenters : (mentor.center ? [mentor.center] : []);
                        const formChips = getFormChips(mentor, false);
                        return (
                            <Card
                                key={mentor.id}
                                onClick={() => navigate(`/mentor/${mentor.id}`)}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') navigate(`/mentor/${mentor.id}`); }}
                                role="button"
                                tabIndex={0}
                                sx={{ mb: 2, boxShadow: 2, borderRadius: 3, cursor: 'pointer' }}
                            >
                                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <Avatar sx={{ width: 48, height: 48, bgcolor: 'primary.light', fontWeight: 600 }}>
                                        {mentor.name ? mentor.name.charAt(0).toUpperCase() : '?'}
                                    </Avatar>
                                    <Box sx={{ flex: 1 }}>
                                        <Typography variant="h6" sx={{ fontWeight: 600 }}>{mentor.name}</Typography>
                                        <Typography variant="body2" color="text.secondary">{centers.join(", ")}</Typography>
                                        {mentor.assignedEvaluator && (
                                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                                Evaluator: {mentor.assignedEvaluator.name}
                                            </Typography>
                                        )}
                                        {formChips.length > 0 && (
                                            <Box sx={{ mt: 0.5, overflowX: 'auto' }} onClick={(e) => e.stopPropagation()}>
                                                <Stack direction="row" spacing={0.5} sx={{ pt: 0.5 }}>
                                                    {formChips}
                                                </Stack>
                                            </Box>
                                        )}
                                    </Box>
                                    <CardActions sx={{ display: 'flex', flexDirection: 'row', gap: 1 }}>
                                        <Tooltip title="View Details">
                                            <IconButton
                                                aria-label="view details"
                                                onClick={(e) => { e.stopPropagation(); navigate(`/mentor/${mentor.id}`); }}
                                                sx={{ p: 1 }}
                                            >
                                                <VisibilityIcon />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Edit">
                                            <IconButton aria-label="edit" onClick={(e) => { e.stopPropagation(); handleOpen(mentor); }} sx={{ p: 1 }}>
                                                <EditIcon />
                                            </IconButton>
                                        </Tooltip>
                                        {userRole !== 'evaluator' && (
                                            <Tooltip title="Delete">
                                                <IconButton aria-label="delete" onClick={(e) => { e.stopPropagation(); handleDelete(mentor.id); }} sx={{ p: 1 }}>
                                                    <DeleteIcon />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                    </CardActions>
                                </CardContent>
                            </Card>
                        );
                    })}
                    <Fab color="primary" aria-label="add" onClick={() => handleOpen()} sx={{ position: 'fixed', bottom: 32, right: 32, zIndex: 1000 }}>
                        <AddIcon />
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
                                const centers = Array.isArray(mentor.assignedCenters) ? mentor.assignedCenters : (mentor.center ? [mentor.center] : []);
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
                                            <Typography variant="body2" color="text.secondary">{centers.join(', ')}</Typography>
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
                                            <Tooltip title="View Details">
                                                <IconButton aria-label="view details" onClick={(e) => { e.stopPropagation(); navigate(`/mentor/${mentor.id}`); }} size="small">
                                                    <VisibilityIcon fontSize="small" />
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