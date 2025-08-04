import React from 'react';
import { Box, Typography } from '@mui/material';

const scaleConfig = {
    1: { label: 'Critical', color: '#D9534F' },
    2: { label: 'Not Up to Expectation', color: '#F0AD4E' },
    3: { label: 'As Expected', color: '#D3D3D3' },
    4: { label: 'Shows Intention', color: '#5BC0DE' },
    5: { label: 'Exceeds Expectations', color: '#428BCA' },
};

const KPIScoreScale = ({ score }) => {
    const currentScoreData = scaleConfig[Math.round(score)] || { label: 'N/A', color: '#777' };

    return (
        <Box sx={{ width: '100%', mt: 2 }}>
            <Typography variant="subtitle1" gutterBottom>Scale</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                 <Typography variant="caption">100%</Typography>
                 <Typography variant="caption">0%</Typography>
                 <Typography variant="caption">100%</Typography>
            </Box>
            <Box sx={{ display: 'flex', height: '20px', width: '100%', border: '1px solid #ccc' }}>
                {Object.entries(scaleConfig).map(([key, { color }]) => (
                    <Box key={key} sx={{ flex: 1, backgroundColor: color, border: Math.round(score) == key ? '3px solid black' : 'none', boxSizing: 'border-box' }}/>
                ))}
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
                 <Typography variant="body2">Current Average: <strong>{currentScoreData.label}</strong> ({score.toFixed(2)})</Typography>
            </Box>
        </Box>
    );
};

export default KPIScoreScale;