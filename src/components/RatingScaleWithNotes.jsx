import React, { useState, useEffect } from 'react';
import { Box, Typography, ToggleButtonGroup, ToggleButton, TextField, IconButton, Collapse } from '@mui/material';
import AddCommentIcon from '@mui/icons-material/AddComment';

const RatingScaleWithNotes = ({ label, options, value, onChange }) => {
    const [notesVisible, setNotesVisible] = useState(false);
    const scoreValue = value?.score;
    const requireNote = !!scoreValue && String(scoreValue) !== '3';

    // Auto-toggle notes visibility when score is not "3" (As Expected)
    useEffect(() => {
        setNotesVisible(requireNote);
    }, [requireNote]);

    const handleScoreChange = (event, newScore) => {
        if (newScore !== null) {
            const next = { ...value, score: newScore };
            // Auto-require note when not selecting "As Expected" (value 3)
            if (String(newScore) !== '3') {
                setNotesVisible(true);
            } else {
                setNotesVisible(false);
                // Clear note when returning to neutral to avoid stale required state
                next.note = '';
            }
            onChange(next);
        }
    };

    const handleNoteChange = (event) => {
        onChange({ ...value, note: event.target.value });
    };

    return (
        <Box sx={{
            p: 2,
            border: '1px solid #e0e0e0',
            borderRadius: 3,
            mb: 2,
            bgcolor: 'background.paper',
            boxShadow: '0 2px 8px 0 rgba(80, 63, 205, 0.04)'
        }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography component="legend" fontWeight="500" sx={{ fontSize: { xs: '1rem', sm: '1.1rem' } }}>{label}</Typography>
                <IconButton onClick={() => setNotesVisible(!notesVisible)} size="small" title="Add Note">
                    <AddCommentIcon color={notesVisible ? "primary" : "action"} />
                </IconButton>
            </Box>
            <Box sx={{
                width: '100%',
                display: 'flex',
                justifyContent: { xs: 'flex-start', sm: 'center' },
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 1,
                pb: 1,
                mt: 1
            }}>
                <ToggleButtonGroup
                    value={value.score}
                    exclusive
                    onChange={handleScoreChange}
                    sx={{
                        flexWrap: 'wrap',
                        justifyContent: { xs: 'flex-start', sm: 'center' },
                        width: '100%',
                        bgcolor: 'transparent',
                        boxShadow: 'none',
                        border: 'none'
                    }}
                >
                    {options.map((opt, i) => (
                        <ToggleButton
                            key={i}
                            value={String(i + 1)}
                            sx={{
                                p: { xs: '6px 10px', sm: '8px 18px' },
                                fontSize: { xs: '0.85rem', sm: '1rem' },
                                borderRadius: 2,
                                color: 'primary.main',
                                bgcolor: 'grey.100',
                                border: 'none',
                                mx: 0.5,
                                my: 0.5,
                                minWidth: 120,
                                '&.Mui-selected': {
                                    bgcolor: 'primary.main',
                                    color: 'primary.contrastText',
                                    fontWeight: 600,
                                },
                                '&:hover': {
                                    bgcolor: 'primary.light',
                                    color: 'primary.contrastText',
                                }
                            }}
                        >
                            {opt}
                        </ToggleButton>
                    ))}
                </ToggleButtonGroup>
            </Box>
            <Collapse in={notesVisible || requireNote}>
                <TextField
                    fullWidth
                    margin="normal"
                    label={requireNote ? "Notes (required when not 'As Expected')" : "Optional Notes"}
                    value={value.note}
                    onChange={handleNoteChange}
                    multiline
                    rows={2}
                    size="small"
                    required={requireNote}
                    error={requireNote && !value.note}
                    helperText={requireNote && !value.note ? 'Please add a note for this rating.' : undefined}
                />
            </Collapse>
        </Box>
    );
};

export default RatingScaleWithNotes;