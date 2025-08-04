import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import { centers } from '../utils/seedData';

const MentorForm = ({ open, onClose, onSave, mentor }) => {
    const [name, setName] = useState('');
    const [center, setCenter] = useState('');

    useEffect(() => {
        if (mentor) {
            setName(mentor.name || '');
            setCenter(mentor.center || '');
        } else {
            setName('');
            setCenter('');
        }
    }, [mentor, open]);

    const handleSave = () => {
        onSave({ name, center });
    };

    return (
        <Dialog open={open} onClose={onClose}>
            <DialogTitle>{mentor ? 'Edit Mentor' : 'Add New Mentor'}</DialogTitle>
            <DialogContent>
                <TextField
                    autoFocus
                    margin="dense"
                    label="Mentor Name"
                    type="text"
                    fullWidth
                    variant="outlined"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
                <FormControl fullWidth margin="dense">
                    <InputLabel>Center</InputLabel>
                    <Select
                        value={center}
                        label="Center"
                        onChange={(e) => setCenter(e.target.value)}
                    >
                        {centers.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                    </Select>
                </FormControl>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={handleSave} variant="contained">Save</Button>
            </DialogActions>
        </Dialog>
    );
};

export default MentorForm;