import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Select, MenuItem, FormControl, InputLabel, Chip, Box, Typography, Autocomplete } from '@mui/material';
import { centers } from '../utils/seedData';
import { db } from '../firebase/config';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

const MentorForm = ({ open, onClose, onSave, mentor }) => {
    const [name, setName] = useState('');
    const [assignedCenters, setAssignedCenters] = useState([]);
    const [assignedEvaluator, setAssignedEvaluator] = useState(null);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [forms, setForms] = useState([]);
    const [assignedFormIds, setAssignedFormIds] = useState([]);
    const [evaluators, setEvaluators] = useState([]);

    useEffect(() => {
        setErrors({});
        setSaving(false);
        if (mentor) {
            setName(mentor.name || '');
            setAssignedCenters(mentor.assignedCenters || (mentor.center ? [mentor.center] : []));
            setAssignedFormIds(Array.isArray(mentor.assignedFormIds) ? mentor.assignedFormIds : []);
            setAssignedEvaluator(mentor.assignedEvaluator || null);
        } else {
            setName('');
            setAssignedCenters([]);
            setAssignedFormIds([]);
            setAssignedEvaluator(null);
        }
    }, [mentor, open]);

    // Subscribe to available KPI forms
    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'kpiForms'), (snap) => {
            const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setForms(arr);
        });
        return () => unsub();
    }, []);

    // Subscribe to available evaluators (users with role Admin, Quality, or Evaluator)
    useEffect(() => {
        const unsub = onSnapshot(
            query(collection(db, 'users'), where('role', 'in', ['Admin', 'Quality', 'Evaluator'])),
            (snap) => {
                const evaluatorList = snap.docs.map(d => ({
                    id: d.id,
                    ...d.data(),
                    label: `${d.data().name || d.data().email} (${d.data().role})`,
                    name: d.data().name || d.data().email
                }));
                setEvaluators(evaluatorList);
            }
        );
        return () => unsub();
    }, []);

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
            // Serialize assignedEvaluator to plain object (avoid Firestore metadata)
            const evaluatorData = assignedEvaluator ? {
                id: assignedEvaluator.id,
                name: assignedEvaluator.name,
                role: assignedEvaluator.role,
                email: assignedEvaluator.email
            } : null;

            await onSave({ 
                name, 
                assignedCenters, 
                assignedFormIds,
                assignedEvaluator: evaluatorData
            });
            setName('');
            setAssignedCenters([]);
            setAssignedFormIds([]);
            setAssignedEvaluator(null);
            setErrors({});
            setSaving(false);
        } catch (err) {
            console.error('Error saving mentor:', err);
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
                <FormControl fullWidth margin="dense">
                    <InputLabel>Assigned KPI Forms</InputLabel>
                    <Select
                        multiple
                        value={assignedFormIds}
                        label="Assigned KPI Forms"
                        onChange={e => setAssignedFormIds(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
                        renderValue={selected => (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {selected.map(id => {
                                    const f = forms.find(ff => ff.id === id);
                                    return <Chip key={id} label={f?.name || id} />;
                                })}
                            </Box>
                        )}
                        inputProps={{ 'aria-label': 'Assigned KPI Forms' }}
                    >
                        {forms.length === 0 && (
                            <MenuItem disabled value="">
                                <em>No forms yet. Create forms in Form Management.</em>
                            </MenuItem>
                        )}
                        {forms.map(f => <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>)}
                    </Select>
                    {forms.length === 0 && (
                        <Typography variant="caption" color="text.secondary">Go to Form Management to create forms.</Typography>
                    )}
                </FormControl>

                {/* Assigned Evaluator Field */}
                <Autocomplete
                    options={evaluators}
                    value={assignedEvaluator}
                    onChange={(event, newValue) => setAssignedEvaluator(newValue)}
                    getOptionLabel={(option) => option.label || ''}
                    isOptionEqualToValue={(option, value) => option?.id === value?.id}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            label="Assigned Evaluator"
                            margin="dense"
                            fullWidth
                            variant="outlined"
                            helperText="Select a user who will receive KPI reminder notifications for this mentor"
                        />
                    )}
                    renderOption={(props, option) => (
                        <Box component="li" {...props}>
                            <Box>
                                <Typography variant="body2">{option.name}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {option.role} • {option.email}
                                </Typography>
                            </Box>
                        </Box>
                    )}
                />

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