import React from 'react';
import { Box, Typography } from '@mui/material';

const scaleBands = [
    { label: 'Critical (1.0-2.0)', color: '#D9534F', min: 1.0, max: 2.0 },
    { label: 'Not Up to Expectations (2.1-3.0)', color: '#F0AD4E', min: 2.1, max: 3.0 },
    { label: 'As Expected (3.1-4.0)', color: '#D3D3D3', min: 3.1, max: 4.0 },
    { label: 'Shows Intention (4.1-4.5)', color: '#5BC0DE', min: 4.1, max: 4.5 },
    { label: 'Exceeds Expectations (4.6-5.0)', color: '#428BCA', min: 4.6, max: 5.0 }
];

const KPIScoreScale = ({ score }) => {
    const activeBand = scaleBands.find(b => score && score >= b.min && score <= b.max);
    const currentScoreData = activeBand || { label: 'N/A', color: '#777' };

    return (
        <Box sx={{ width: '100%', mt: 2 }}>
            <Typography variant="subtitle1" gutterBottom>Scale</Typography>
            <Box sx={{ display: 'flex', height: '22px', width: '100%', border: '1px solid #ccc', borderRadius: 1, overflow: 'hidden' }}>
                {scaleBands.map((band, idx) => (
                    <Box
                        key={band.label}
                        sx={{
                            flex: 1,
                            backgroundColor: band.color,
                            border: activeBand === band ? '3px solid black' : 'none',
                            boxSizing: 'border-box'
                        }}
                    />
                ))}
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
                 <Typography variant="body2">Current Average: <strong>{currentScoreData.label}</strong> ({Number(score || 0).toFixed(2)})</Typography>
            </Box>
        </Box>
    );
};

export default KPIScoreScale;