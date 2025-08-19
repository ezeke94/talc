import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Select, MenuItem, FormControl, InputLabel, Chip } from '@mui/material';
import { centers } from '../utils/seedData';

const MentorForm = ({ open, onClose, onSave, mentor }) => {
    const [name, setName] = useState('');
    const [assignedCenters, setAssignedCenters] = useState([]);

    useEffect(() => {
        if (mentor) {
            setName(mentor.name || '');
            setAssignedCenters(mentor.assignedCenters || (mentor.center ? [mentor.center] : []));
        } else {
            setName('');
            setAssignedCenters([]);
        }
    }, [mentor, open]);

    const handleSave = () => {
        onSave({ name, assignedCenters });
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
                    <InputLabel>Assigned Centers</InputLabel>
                    <Select
                        multiple
                        value={assignedCenters}
                        label="Assigned Centers"
                        onChange={e => setAssignedCenters(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
                        renderValue={selected => (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {selected.map(value => <Chip key={value} label={value} />)}
                            </Box>
                        )}
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