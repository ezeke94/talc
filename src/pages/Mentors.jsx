import React, { useState, useEffect } from 'react';
import { Box, Card, CardContent, CardActions, Avatar, IconButton, Button, Typography, Fab, useTheme, useMediaQuery, Tooltip, TextField } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AddIcon from '@mui/icons-material/Add';
import { db } from '../firebase/config';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
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
    const { currentUser: authUser } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'mentors'), (snapshot) => {
            const mentorData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMentors(mentorData);
        });
        return () => unsubscribe();
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
                        return (
                            <Card key={mentor.id} sx={{ mb: 2, boxShadow: 2, borderRadius: 3 }}>
                                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <Avatar sx={{ width: 48, height: 48, bgcolor: 'primary.light', fontWeight: 600 }}>
                                        {mentor.name ? mentor.name.charAt(0).toUpperCase() : '?'}
                                    </Avatar>
                                    <Box sx={{ flex: 1 }}>
                                        <Typography variant="h6" sx={{ fontWeight: 600 }}>{mentor.name}</Typography>
                                        <Typography variant="body2" color="text.secondary">{centers.join(", ")}</Typography>
                                    </Box>
                                    <CardActions sx={{ display: 'flex', flexDirection: 'row', gap: 1 }}>
                                        <Tooltip title="View Details">
                                            <IconButton aria-label="view details" onClick={() => navigate(`/mentor/${mentor.id}`)} sx={{ p: 1 }}>
                                                <VisibilityIcon />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Edit">
                                            <IconButton aria-label="edit" onClick={() => handleOpen(mentor)} sx={{ p: 1 }}>
                                                <EditIcon />
                                            </IconButton>
                                        </Tooltip>
                                        {userRole !== 'evaluator' && (
                                            <Tooltip title="Delete">
                                                <IconButton aria-label="delete" onClick={() => handleDelete(mentor.id)} sx={{ p: 1 }}>
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
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, justifyContent: 'center', alignItems: 'flex-start', mt: 2 }}>
                    {filteredMentors.map(mentor => {
                        const centers = Array.isArray(mentor.assignedCenters) ? mentor.assignedCenters : (mentor.center ? [mentor.center] : []);
                        return (
                            <Card
                                key={mentor.id}
                                sx={{
                                    width: 240,
                                    minHeight: 180,
                                    boxShadow: 3,
                                    borderRadius: 3,
                                    transition: 'box-shadow 0.2s',
                                    '&:hover': { boxShadow: 6 },
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    alignItems: 'stretch',
                                }}
                            >
                                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, minHeight: 90 }}>
                                    <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.light', fontWeight: 700 }}>
                                        {mentor.name ? mentor.name.charAt(0).toUpperCase() : '?'}
                                    </Avatar>
                                    <Box sx={{ flex: 1 }}>
                                        <Typography variant="h6" sx={{ fontWeight: 700, wordBreak: 'break-word' }}>{mentor.name}</Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>{centers.join(", ")}</Typography>
                                    </Box>
                                </CardContent>
                                <CardActions sx={{ justifyContent: 'flex-end', gap: 1, pb: 1 }}>
                                    <Tooltip title="View Details">
                                        <IconButton aria-label="view details" onClick={() => navigate(`/mentor/${mentor.id}`)} sx={{ p: 1 }}>
                                            <VisibilityIcon />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Edit">
                                        <IconButton aria-label="edit" onClick={() => handleOpen(mentor)} sx={{ p: 1 }}>
                                            <EditIcon />
                                        </IconButton>
                                    </Tooltip>
                                    {userRole !== 'evaluator' && (
                                        <Tooltip title="Delete">
                                            <IconButton aria-label="delete" onClick={() => handleDelete(mentor.id)} sx={{ p: 1 }}>
                                                <DeleteIcon />
                                            </IconButton>
                                        </Tooltip>
                                    )}
                                </CardActions>
                            </Card>
                        );
                    })}
                </Box>
            )}
            <MentorForm open={open} onClose={handleClose} onSave={handleSave} mentor={currentMentor} />
        </Box>
    );
};

export default Mentors;