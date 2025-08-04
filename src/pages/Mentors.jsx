import React, { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { List, ListItem, ListItemText, ListItemSecondaryAction, IconButton, Button, Typography, Box } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useNavigate } from 'react-router-dom';
import MentorForm from '../components/MentorForm';

const Mentors = () => {
    const [mentors, setMentors] = useState([]);
    const [open, setOpen] = useState(false);
    const [currentMentor, setCurrentMentor] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'mentors'), (snapshot) => {
            const mentorData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMentors(mentorData);
        });
        return () => unsubscribe();
    }, []);

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

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h4">Manage Mentors</Typography>
                <Button variant="contained" onClick={() => handleOpen()}>Add Mentor</Button>
            </Box>
            <List>
                {mentors.map(mentor => (
                    <ListItem key={mentor.id} button onClick={() => navigate(`/mentor/${mentor.id}`)} divider>
                        <ListItemText primary={mentor.name} secondary={mentor.center} />
                        <ListItemSecondaryAction>
                            <IconButton edge="end" aria-label="edit" onClick={(e) => { e.stopPropagation(); handleOpen(mentor); }}>
                                <EditIcon />
                            </IconButton>
                            <IconButton edge="end" aria-label="delete" onClick={(e) => { e.stopPropagation(); handleDelete(mentor.id); }}>
                                <DeleteIcon />
                            </IconButton>
                        </ListItemSecondaryAction>
                    </ListItem>
                ))}
            </List>
            <MentorForm open={open} onClose={handleClose} onSave={handleSave} mentor={currentMentor} />
        </Box>
    );
};

export default Mentors;