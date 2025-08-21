import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Select, MenuItem, FormControl, InputLabel, Chip, Box } from '@mui/material';
import { centers } from '../utils/seedData';

const MentorForm = ({ open, onClose, onSave, mentor }) => {
    const [name, setName] = useState('');
    const [assignedCenters, setAssignedCenters] = useState([]);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setErrors({});
        setSaving(false);
        if (mentor) {
            setName(mentor.name || '');
            setAssignedCenters(mentor.assignedCenters || (mentor.center ? [mentor.center] : []));
        } else {
            setName('');
            setAssignedCenters([]);
        }
    }, [mentor, open]);

    const validate = () => {
        const newErrors = {};
        if (!name.trim()) newErrors.name = 'Mentor name is required.';
        if (!assignedCenters.length) newErrors.assignedCenters = 'At least one center must be assigned.';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        if (!validate()) return;
        setSaving(true);
        try {
            await onSave({ name, assignedCenters });
            setName('');
            setAssignedCenters([]);
            setErrors({});
            setSaving(false);
        } catch (err) {
            setErrors({ form: 'Failed to save. Please try again.' });
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} aria-labelledby="mentor-form-dialog-title" TransitionProps={{ appear: true }}>
            <DialogTitle id="mentor-form-dialog-title">{mentor ? 'Edit Mentor' : 'Add New Mentor'}</DialogTitle>
            <DialogContent sx={{ minWidth: { xs: 260, sm: 400 } }}>
                <TextField
                    autoFocus
                    margin="dense"
                    label="Mentor Name"
                    type="text"
                    fullWidth
                    variant="outlined"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    error={!!errors.name}
                    helperText={errors.name}
                    inputProps={{ 'aria-label': 'Mentor Name' }}
                />
                <FormControl fullWidth margin="dense" error={!!errors.assignedCenters}>
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
                        inputProps={{ 'aria-label': 'Assigned Centers' }}
                    >
                        {centers.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                    </Select>
                    {errors.assignedCenters && <Box sx={{ color: 'error.main', fontSize: 13, mt: 0.5 }}>{errors.assignedCenters}</Box>}
                </FormControl>
                {errors.form && <Box sx={{ color: 'error.main', fontSize: 13, mt: 1 }}>{errors.form}</Box>}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} aria-label="Cancel">Cancel</Button>
                <Button onClick={handleSave} variant="contained" disabled={saving} aria-label="Save Mentor">
                    {saving ? 'Saving...' : 'Save'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default MentorForm;