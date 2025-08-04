import React, { useState } from 'react';
import { Box, Typography, ToggleButtonGroup, ToggleButton, TextField, IconButton, Collapse } from '@mui/material';
import AddCommentIcon from '@mui/icons-material/AddComment';

const RatingScaleWithNotes = ({ label, options, value, onChange }) => {
    const [notesVisible, setNotesVisible] = useState(false);

    const handleScoreChange = (event, newScore) => {
        if (newScore !== null) {
            onChange({ ...value, score: newScore });
        }
    };

    const handleNoteChange = (event) => {
        onChange({ ...value, note: event.target.value });
    };

    return (
        <Box sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography component="legend" fontWeight="500">{label}</Typography>
                <IconButton onClick={() => setNotesVisible(!notesVisible)} size="small" title="Add Note">
                    <AddCommentIcon color={notesVisible ? "primary" : "action"} />
                </IconButton>
            </Box>
            <ToggleButtonGroup
                value={value.score}
                exclusive
                onChange={handleScoreChange}
                fullWidth
                sx={{ mt: 1 }}
            >
                {options.map((opt, i) => (
                    <ToggleButton key={i} value={String(i + 1)} sx={{ p: 1, fontSize: '0.75rem' }}>
                        {opt}
                    </ToggleButton>
                ))}
            </ToggleButtonGroup>
            <Collapse in={notesVisible}>
                <TextField
                    fullWidth
                    margin="normal"
                    label="Optional Notes"
                    value={value.note}
                    onChange={handleNoteChange}
                    multiline
                    rows={2}
                    size="small"
                />
            </Collapse>
        </Box>
    );
};

export default RatingScaleWithNotes;